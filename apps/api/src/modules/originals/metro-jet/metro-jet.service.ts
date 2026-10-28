import { createHash, randomUUID } from 'node:crypto';

import {
  JET_BETTING_MS,
  JET_PAUSE_MS,
  type jetBetRequestSchema,
  jetElapsedFor,
  type JetHistoryItem,
  jetMultiplierAt,
  type JetMyBet,
  type JetPhase,
  type JetPublicBet,
  type JetState,
  type OriginalsAck,
} from '@metrobet/contracts';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq, inArray, max } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../../config/env.js';
import { type Database, DRIZZLE } from '../../../database/database.tokens.js';
import { OriginalsWallet, type WalletResult } from '../wallet/originals-wallet.js';
import { crashPointFor, newSeed, seedHash } from './metro-jet-fairness.js';
import { jetBets, jetRounds } from './metro-jet.schema.js';

const TICK_MS = 100;
const RECONCILE_MS = 60_000;
/** Bets must reach us this long before the window closes (the wallet call takes time). */
const BET_CUTOFF_MS = 100;
const HISTORY_SIZE = 20;

type Slot = z.output<typeof jetBetRequestSchema>['slot'];
type Bet = {
  id: string;
  roundId: string;
  token: string;
  key: string;
  slot: Slot;
  amount: number;
  autoCashout: number | null;
  status: 'pending' | 'placed' | 'cashed' | 'lost';
  cashedAt: number | null;
  win: number;
};
type Round = {
  id: string;
  number: number;
  seed: string;
  seedHash: string;
  crashPoint: number;
  phase: JetPhase;
  bettingEndsAt: number;
  startedAt: number | null;
  crashAt: number | null;
  crashedAt: number | null;
};

/** What the gateway should push: `phase` = everyone's full state, the rest are targeted. */
export type JetEvent =
  | { type: 'phase' }
  | { type: 'bets' }
  | { type: 'mine'; key: string }
  | { type: 'balance'; key: string; balance: number };

/** Groups a viewer's bets and tags them publicly, without exposing the session token. */
export const playerKey = (token: string) => createHash('sha256').update(token).digest('hex');
const transactionIds = (betId: string) => ({
  bet: `jet-bet:${betId}`,
  win: `jet-win:${betId}`,
  rollback: `jet-rollback:${betId}`,
  round: `jet-round:${betId}`,
});
/** bet × multiplier, in whole minor units, without float drift. */
const payout = (amount: number, multiplier: number) =>
  Math.floor((amount * Math.round(multiplier * 100)) / 100);

/**
 * Metro Jet game server: one shared round at a time, driven by `advance(now)` (a 100 ms loop,
 * or by hand in tests). Server-authoritative: the crash point is fixed before betting (provably
 * fair), cash-outs are priced at the server's clock. Money moves only through OriginalsWallet;
 * every bet is stored so a restart can finish it (`reconcile`).
 */
@Injectable()
export class MetroJetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetroJetService.name);
  private readonly listeners = new Set<(event: JetEvent) => void>();
  private readonly bets = new Map<string, Bet>();
  private round: Round | null = null;
  private lastNumber = 0;
  private history: JetHistoryItem[] = [];
  private advancing = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(OriginalsWallet) private readonly wallet: OriginalsWallet,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    await this.recover();
    if (this.config.get('ORIGINALS_JET_LOOP', { infer: true }) === 'on') {
      this.timers.push(
        setInterval(() => void this.advance(Date.now()), TICK_MS),
        setInterval(() => void this.reconcile(), RECONCILE_MS),
      );
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
  }

  on(listener: (event: JetEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The round as one viewer sees it (`key`: their player key, or null for spectators). */
  state(key: string | null, now = Date.now()): JetState | null {
    const round = this.round;
    if (!round) return null;
    const crashed = round.phase === 'crashed';
    const visible = [...this.bets.values()].filter((bet) => bet.status !== 'pending');
    return {
      serverTime: now,
      round: {
        number: round.number,
        phase: round.phase,
        seedHash: round.seedHash,
        bettingEndsAt: round.bettingEndsAt,
        startedAt: round.startedAt,
        crashPoint: crashed ? round.crashPoint : null,
        seed: crashed ? round.seed : null,
      },
      history: this.history,
      bets: visible.map((bet): JetPublicBet => ({
        tag: bet.key.slice(0, 4).toUpperCase(),
        slot: bet.slot,
        amount: bet.amount,
        cashedAt: bet.cashedAt,
        win: bet.win,
      })),
      mine: key ? this.mine(key) : [],
    };
  }

  mine(key: string): JetMyBet[] {
    return [...this.bets.values()]
      .filter((bet) => bet.key === key && bet.status !== 'pending')
      .map((bet) => ({
        slot: bet.slot,
        amount: bet.amount,
        autoCashout: bet.autoCashout,
        status: bet.status as JetMyBet['status'],
        cashedAt: bet.cashedAt,
        win: bet.win,
      }));
  }

  /** Moves the round forward to `now`. Re-entrant calls are skipped (the loop calls again). */
  async advance(now: number): Promise<void> {
    if (this.advancing) return;
    this.advancing = true;
    try {
      const round = this.round;
      if (!round || (round.phase === 'crashed' && now >= round.crashedAt! + JET_PAUSE_MS)) {
        await this.newRound(now);
      } else if (round.phase === 'betting' && now >= round.bettingEndsAt) {
        await this.takeOff(round, now);
      } else if (round.phase === 'flying') {
        await this.fly(round, now);
      }
    } catch (error) {
      this.logger.error('Metro Jet round failed to advance', error);
    } finally {
      this.advancing = false;
    }
  }

  async placeBet(
    token: string,
    { slot, amount, autoCashout }: z.output<typeof jetBetRequestSchema>,
    now = Date.now(),
  ): Promise<OriginalsAck<null>> {
    const round = this.round;
    if (round?.phase !== 'betting' || now > round.bettingEndsAt - BET_CUTOFF_MS) {
      return { ok: false, code: 'WRONG_PHASE' };
    }
    const key = playerKey(token);
    if (this.bets.has(`${key}:${slot}`)) return { ok: false, code: 'ALREADY_BET' };

    const bet: Bet = {
      id: randomUUID(),
      roundId: round.id,
      token,
      key,
      slot,
      amount,
      autoCashout,
      status: 'pending',
      cashedAt: null,
      win: 0,
    };
    this.bets.set(`${key}:${slot}`, bet);
    await this.db.insert(jetBets).values({
      id: bet.id,
      roundId: round.id,
      sessionToken: token,
      playerKey: key,
      slot,
      amount,
      autoCashout,
    });

    const ids = transactionIds(bet.id);
    const placed = await this.wallet.bet(token, {
      transactionId: ids.bet,
      roundId: ids.round,
      amount,
    });
    const inTime = this.round?.id === round.id && this.round.phase === 'betting';
    if (placed.ok && inTime) {
      bet.status = 'placed';
      await this.db.update(jetBets).set({ status: 'placed' }).where(eq(jetBets.id, bet.id));
      this.emit(
        { type: 'bets' },
        { type: 'mine', key },
        { type: 'balance', key, balance: placed.balance },
      );
      return { ok: true, data: null };
    }

    // Refused, unknown outcome, or the jet took off meanwhile: drop it and refund if needed.
    this.bets.delete(`${key}:${slot}`);
    if (placed.ok || placed.code === null) await this.refund(bet);
    else
      await this.db
        .update(jetBets)
        .set({ status: 'refunded', settled: true })
        .where(eq(jetBets.id, bet.id));
    return { ok: false, code: placed.ok ? 'WRONG_PHASE' : (placed.code ?? 'UNAVAILABLE') };
  }

  /** Takes a placed bet back while betting is open (refunded in full). */
  async cancel(token: string, slot: Slot): Promise<OriginalsAck<null>> {
    const key = playerKey(token);
    const bet = this.bets.get(`${key}:${slot}`);
    if (this.round?.phase !== 'betting') return { ok: false, code: 'WRONG_PHASE' };
    if (bet?.status !== 'placed') return { ok: false, code: 'NO_BET' };
    this.bets.delete(`${key}:${slot}`);
    this.emit({ type: 'bets' }, { type: 'mine', key });
    const refunded = await this.refund(bet);
    return refunded.ok ? { ok: true, data: null } : { ok: false, code: 'UNAVAILABLE' };
  }

  /** Cashes out at the multiplier on the server's clock now. Too late = the jet already left. */
  async cashout(
    token: string,
    slot: Slot,
    now = Date.now(),
  ): Promise<OriginalsAck<{ multiplier: number; win: number }>> {
    const round = this.round;
    if (round?.phase !== 'flying' || now >= round.crashAt!)
      return { ok: false, code: 'WRONG_PHASE' };
    const bet = this.bets.get(`${playerKey(token)}:${slot}`);
    if (bet?.status !== 'placed') return { ok: false, code: 'NO_BET' };
    const multiplier = jetMultiplierAt(now - round.startedAt!);
    await this.cash(bet, multiplier);
    const paid = await this.settle(bet);
    return paid.ok
      ? { ok: true, data: { multiplier, win: bet.win } }
      : { ok: false, code: 'UNAVAILABLE' };
  }

  /**
   * Finishes every unsettled bet that is not live in memory (after a restart, or a wallet call
   * that failed): refunds bets of rounds that never finished, closes lost ones, pays wins.
   */
  async reconcile(): Promise<void> {
    const live = new Set([...this.bets.values()].map((bet) => bet.id));
    const rows = await this.db
      .select({ bet: jetBets, roundStatus: jetRounds.status })
      .from(jetBets)
      .innerJoin(jetRounds, eq(jetBets.roundId, jetRounds.id))
      .where(eq(jetBets.settled, false))
      .orderBy(jetBets.createdAt)
      .limit(100);
    for (const { bet: row, roundStatus } of rows) {
      if (live.has(row.id)) continue;
      const bet: Bet = {
        id: row.id,
        roundId: row.roundId,
        token: row.sessionToken,
        key: row.playerKey,
        slot: row.slot as Slot,
        amount: row.amount,
        autoCashout: row.autoCashout,
        status: row.status === 'refunded' ? 'pending' : row.status,
        cashedAt: row.cashedAt,
        win: row.win,
      };
      const finished = roundStatus === 'crashed';
      const result =
        row.status === 'cashed' || row.status === 'lost' || (row.status === 'placed' && finished)
          ? await this.settle(bet)
          : await this.refund(bet);
      if (!result.ok && result.code !== null) {
        // The wallet will never accept it (e.g. a demo session lost on restart): stop retrying.
        this.logger.warn(`Metro Jet bet ${row.id} given up: ${result.code}`);
        await this.db.update(jetBets).set({ settled: true }).where(eq(jetBets.id, row.id));
      }
    }
  }

  private async newRound(now: number) {
    const number = this.lastNumber + 1;
    const seed = newSeed();
    const round: Round = {
      id: randomUUID(),
      number,
      seed,
      seedHash: seedHash(seed),
      crashPoint: crashPointFor(seed, number),
      phase: 'betting',
      bettingEndsAt: now + JET_BETTING_MS,
      startedAt: null,
      crashAt: null,
      crashedAt: null,
    };
    await this.db.insert(jetRounds).values({
      id: round.id,
      number,
      seed,
      seedHash: round.seedHash,
      crashPoint: round.crashPoint,
    });
    this.lastNumber = number;
    this.round = round;
    this.bets.clear();
    this.emit({ type: 'phase' });
  }

  private async takeOff(round: Round, now: number) {
    round.phase = 'flying';
    round.startedAt = now;
    round.crashAt = now + jetElapsedFor(round.crashPoint);
    await this.db
      .update(jetRounds)
      .set({ status: 'flying', startedAt: new Date(now) })
      .where(eq(jetRounds.id, round.id));
    this.emit({ type: 'phase' });
  }

  private async fly(round: Round, now: number) {
    const crashed = now >= round.crashAt!;
    const multiplier = crashed ? round.crashPoint : jetMultiplierAt(now - round.startedAt!);
    for (const bet of this.bets.values()) {
      const target = bet.autoCashout;
      if (
        bet.status === 'placed' &&
        target !== null &&
        target <= multiplier &&
        target <= round.crashPoint
      ) {
        await this.cash(bet, target);
        void this.settle(bet);
      }
    }
    if (crashed) await this.crash(round, now);
  }

  private async crash(round: Round, now: number) {
    round.phase = 'crashed';
    round.crashedAt = now;
    const lost = [...this.bets.values()].filter((bet) => bet.status === 'placed');
    for (const bet of lost) bet.status = 'lost';
    await this.db
      .update(jetRounds)
      .set({ status: 'crashed', crashedAt: new Date(now) })
      .where(eq(jetRounds.id, round.id));
    if (lost.length > 0) {
      await this.db
        .update(jetBets)
        .set({ status: 'lost' })
        .where(
          inArray(
            jetBets.id,
            lost.map((bet) => bet.id),
          ),
        );
    }
    this.history = [
      { number: round.number, crashPoint: round.crashPoint, seed: round.seed },
      ...this.history,
    ].slice(0, HISTORY_SIZE);
    this.emit({ type: 'phase' });
    for (const bet of lost) void this.settle(bet);
  }

  private async cash(bet: Bet, multiplier: number) {
    bet.status = 'cashed';
    bet.cashedAt = multiplier;
    bet.win = payout(bet.amount, multiplier);
    await this.db
      .update(jetBets)
      .set({ status: 'cashed', cashedAt: multiplier, win: bet.win })
      .where(eq(jetBets.id, bet.id));
    this.emit({ type: 'bets' }, { type: 'mine', key: bet.key });
  }

  /** Delivers the final result (win, or 0 for a loss) and closes the wallet round. */
  private async settle(bet: Bet): Promise<WalletResult> {
    const ids = transactionIds(bet.id);
    const result = await this.wallet.win(bet.token, {
      transactionId: ids.win,
      roundId: ids.round,
      amount: bet.status === 'cashed' ? bet.win : 0,
    });
    if (result.ok) {
      await this.db.update(jetBets).set({ settled: true }).where(eq(jetBets.id, bet.id));
      this.emit({ type: 'balance', key: bet.key, balance: result.balance });
    } else {
      this.logger.warn(`Metro Jet bet ${bet.id} not settled yet (${result.code ?? 'no answer'})`);
    }
    return result;
  }

  /** Rolls the bet back (safe even if it never reached the wallet). */
  private async refund(bet: Bet): Promise<WalletResult> {
    await this.db.update(jetBets).set({ status: 'refunded' }).where(eq(jetBets.id, bet.id));
    const ids = transactionIds(bet.id);
    const result = await this.wallet.rollback(bet.token, {
      transactionId: ids.rollback,
      roundId: ids.round,
      rollbackOf: ids.bet,
    });
    if (result.ok) {
      await this.db.update(jetBets).set({ settled: true }).where(eq(jetBets.id, bet.id));
      this.emit({ type: 'balance', key: bet.key, balance: result.balance });
    }
    return result;
  }

  /** On boot: rounds cut short by a restart are void, then their bets are reconciled. */
  private async recover() {
    await this.db
      .update(jetRounds)
      .set({ status: 'void' })
      .where(inArray(jetRounds.status, ['betting', 'flying']));
    const [last] = await this.db.select({ value: max(jetRounds.number) }).from(jetRounds);
    this.lastNumber = last?.value ?? 0;
    const crashed = await this.db
      .select({ number: jetRounds.number, crashPoint: jetRounds.crashPoint, seed: jetRounds.seed })
      .from(jetRounds)
      .where(eq(jetRounds.status, 'crashed'))
      .orderBy(desc(jetRounds.number))
      .limit(HISTORY_SIZE);
    this.history = crashed;
    await this.reconcile();
  }

  private emit(...events: JetEvent[]) {
    for (const event of events) for (const listener of this.listeners) listener(event);
  }
}
