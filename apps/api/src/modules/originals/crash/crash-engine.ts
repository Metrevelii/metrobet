import { createHash, randomUUID } from 'node:crypto';

import {
  CRASH_BETTING_MS,
  CRASH_PAUSE_MS,
  type crashBetRequestSchema,
  crashElapsedFor,
  type CrashGame,
  type CrashHistoryItem,
  crashMultiplierAt,
  type CrashMyBet,
  type CrashPhase,
  type CrashPublicBet,
  type CrashState,
  type OriginalsAck,
} from '@metrobet/contracts';
import { Logger } from '@nestjs/common';
import { and, desc, eq, inArray, max } from 'drizzle-orm';
import type { z } from 'zod';

import type { Database } from '../../../database/database.tokens.js';
import type { OriginalsWallet, WalletResult } from '../wallet/originals-wallet.js';
import { crashPointFor, newSeed, seedHash } from './crash-fairness.js';
import { crashBets, crashRounds } from './crash.schema.js';

/** Bets must reach us this long before the window closes (the wallet call takes time). */
const BET_CUTOFF_MS = 100;
const HISTORY_SIZE = 20;

export type Slot = z.output<typeof crashBetRequestSchema>['slot'];
export type BetInput = Omit<z.output<typeof crashBetRequestSchema>, 'game'>;

export type Bet = {
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
  phase: CrashPhase;
  bettingEndsAt: number;
  startedAt: number | null;
  crashAt: number | null;
  crashedAt: number | null;
};

/** What the gateway should push: `phase` = everyone's full state, the rest are targeted. */
export type CrashEvent =
  | { type: 'phase'; game: CrashGame }
  | { type: 'bets'; game: CrashGame }
  | { type: 'mine'; game: CrashGame; key: string }
  | { type: 'balance'; key: string; balance: number };

/** Groups a viewer's bets and tags them publicly, without exposing the session token. */
export const playerKey = (token: string) => createHash('sha256').update(token).digest('hex');

export const transactionIds = (betId: string) => ({
  bet: `crash-bet:${betId}`,
  win: `crash-win:${betId}`,
  rollback: `crash-rollback:${betId}`,
  round: `crash-round:${betId}`,
});

/** bet × multiplier, in whole minor units, without float drift. */
const payout = (amount: number, multiplier: number) =>
  Math.floor((amount * Math.round(multiplier * 100)) / 100);

/**
 * One crash game's server: one shared round at a time, driven by `advance(now)`. Server-
 * authoritative: the crash point is fixed before betting (provably fair), cash-outs are priced
 * at the server's clock. Money moves only through OriginalsWallet; every bet is stored first so
 * a restart can finish it (CrashService.reconcile). Every game runs the same rules; only the
 * client's picture differs.
 */
export class CrashEngine {
  private readonly logger: Logger;
  private readonly bets = new Map<string, Bet>();
  private round: Round | null = null;
  private lastNumber = 0;
  private history: CrashHistoryItem[] = [];
  private advancing = false;

  constructor(
    readonly game: CrashGame,
    private readonly db: Database,
    private readonly wallet: OriginalsWallet,
    private readonly emit: (...events: CrashEvent[]) => void,
  ) {
    this.logger = new Logger(`CrashEngine:${game}`);
  }

  /** Bets of the current round that live in memory (reconciliation skips them). */
  liveBetIds(): string[] {
    return [...this.bets.values()].map((bet) => bet.id);
  }

  /** On boot: rounds cut short by a restart become `void`; loads numbering and history. */
  async recover() {
    await this.db
      .update(crashRounds)
      .set({ status: 'void' })
      .where(
        and(eq(crashRounds.game, this.game), inArray(crashRounds.status, ['betting', 'flying'])),
      );
    const [last] = await this.db
      .select({ value: max(crashRounds.number) })
      .from(crashRounds)
      .where(eq(crashRounds.game, this.game));
    this.lastNumber = last?.value ?? 0;
    this.history = await this.db
      .select({
        number: crashRounds.number,
        crashPoint: crashRounds.crashPoint,
        seed: crashRounds.seed,
      })
      .from(crashRounds)
      .where(and(eq(crashRounds.game, this.game), eq(crashRounds.status, 'crashed')))
      .orderBy(desc(crashRounds.number))
      .limit(HISTORY_SIZE);
  }

  /** The round as one viewer sees it (`key`: their player key, or null for spectators). */
  state(key: string | null, now = Date.now()): CrashState | null {
    const round = this.round;
    if (!round) return null;
    const crashed = round.phase === 'crashed';
    const visible = [...this.bets.values()].filter((bet) => bet.status !== 'pending');
    return {
      game: this.game,
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
      bets: visible.map((bet): CrashPublicBet => ({
        tag: bet.key.slice(0, 4).toUpperCase(),
        slot: bet.slot,
        amount: bet.amount,
        cashedAt: bet.cashedAt,
        win: bet.win,
      })),
      mine: key ? this.mine(key) : [],
    };
  }

  mine(key: string): CrashMyBet[] {
    return [...this.bets.values()]
      .filter((bet) => bet.key === key && bet.status !== 'pending')
      .map((bet) => ({
        slot: bet.slot,
        amount: bet.amount,
        autoCashout: bet.autoCashout,
        status: bet.status as CrashMyBet['status'],
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
      if (!round || (round.phase === 'crashed' && now >= round.crashedAt! + CRASH_PAUSE_MS)) {
        await this.newRound(now);
      } else if (round.phase === 'betting' && now >= round.bettingEndsAt) {
        await this.takeOff(round, now);
      } else if (round.phase === 'flying') {
        await this.fly(round, now);
      }
    } catch (error) {
      this.logger.error('Round failed to advance', error);
    } finally {
      this.advancing = false;
    }
  }

  async placeBet(
    token: string,
    { slot, amount, autoCashout }: BetInput,
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
    await this.db.insert(crashBets).values({
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
      await this.db.update(crashBets).set({ status: 'placed' }).where(eq(crashBets.id, bet.id));
      this.emit(
        { type: 'bets', game: this.game },
        { type: 'mine', game: this.game, key },
        { type: 'balance', key, balance: placed.balance },
      );
      return { ok: true, data: null };
    }

    // Refused, unknown outcome, or the round took off meanwhile: drop it and refund if needed.
    this.bets.delete(`${key}:${slot}`);
    if (placed.ok || placed.code === null) await this.refund(bet);
    else {
      await this.db
        .update(crashBets)
        .set({ status: 'refunded', settled: true })
        .where(eq(crashBets.id, bet.id));
    }
    return { ok: false, code: placed.ok ? 'WRONG_PHASE' : (placed.code ?? 'UNAVAILABLE') };
  }

  /** Takes a placed bet back while betting is open (refunded in full). */
  async cancel(token: string, slot: Slot): Promise<OriginalsAck<null>> {
    const key = playerKey(token);
    const bet = this.bets.get(`${key}:${slot}`);
    if (this.round?.phase !== 'betting') return { ok: false, code: 'WRONG_PHASE' };
    if (bet?.status !== 'placed') return { ok: false, code: 'NO_BET' };
    this.bets.delete(`${key}:${slot}`);
    this.emit({ type: 'bets', game: this.game }, { type: 'mine', game: this.game, key });
    const refunded = await this.refund(bet);
    return refunded.ok ? { ok: true, data: null } : { ok: false, code: 'UNAVAILABLE' };
  }

  /** Cashes out at the multiplier on the server's clock now. Too late = it already crashed. */
  async cashout(
    token: string,
    slot: Slot,
    now = Date.now(),
  ): Promise<OriginalsAck<{ multiplier: number; win: number }>> {
    const round = this.round;
    if (round?.phase !== 'flying' || now >= round.crashAt!) {
      return { ok: false, code: 'WRONG_PHASE' };
    }
    const bet = this.bets.get(`${playerKey(token)}:${slot}`);
    if (bet?.status !== 'placed') return { ok: false, code: 'NO_BET' };
    const multiplier = crashMultiplierAt(now - round.startedAt!);
    await this.cash(bet, multiplier);
    const paid = await this.settle(bet);
    return paid.ok
      ? { ok: true, data: { multiplier, win: bet.win } }
      : { ok: false, code: 'UNAVAILABLE' };
  }

  /** Delivers the final result (win, or 0 for a loss) and closes the wallet round. */
  async settle(bet: Bet): Promise<WalletResult> {
    const ids = transactionIds(bet.id);
    const result = await this.wallet.win(bet.token, {
      transactionId: ids.win,
      roundId: ids.round,
      amount: bet.status === 'cashed' ? bet.win : 0,
    });
    if (result.ok) {
      await this.db.update(crashBets).set({ settled: true }).where(eq(crashBets.id, bet.id));
      this.emit({ type: 'balance', key: bet.key, balance: result.balance });
    } else {
      this.logger.warn(`Bet ${bet.id} not settled yet (${result.code ?? 'no answer'})`);
    }
    return result;
  }

  /** Rolls the bet back (safe even if it never reached the wallet). */
  async refund(bet: Bet): Promise<WalletResult> {
    await this.db.update(crashBets).set({ status: 'refunded' }).where(eq(crashBets.id, bet.id));
    const ids = transactionIds(bet.id);
    const result = await this.wallet.rollback(bet.token, {
      transactionId: ids.rollback,
      roundId: ids.round,
      rollbackOf: ids.bet,
    });
    if (result.ok) {
      await this.db.update(crashBets).set({ settled: true }).where(eq(crashBets.id, bet.id));
      this.emit({ type: 'balance', key: bet.key, balance: result.balance });
    }
    return result;
  }

  private async newRound(now: number) {
    const number = this.lastNumber + 1;
    const seed = newSeed();
    const round: Round = {
      id: randomUUID(),
      number,
      seed,
      seedHash: seedHash(seed),
      crashPoint: crashPointFor(seed, this.game, number),
      phase: 'betting',
      bettingEndsAt: now + CRASH_BETTING_MS,
      startedAt: null,
      crashAt: null,
      crashedAt: null,
    };
    await this.db.insert(crashRounds).values({
      id: round.id,
      game: this.game,
      number,
      seed,
      seedHash: round.seedHash,
      crashPoint: round.crashPoint,
    });
    this.lastNumber = number;
    this.round = round;
    this.bets.clear();
    this.emit({ type: 'phase', game: this.game });
  }

  private async takeOff(round: Round, now: number) {
    round.phase = 'flying';
    round.startedAt = now;
    round.crashAt = now + crashElapsedFor(round.crashPoint);
    await this.db
      .update(crashRounds)
      .set({ status: 'flying', startedAt: new Date(now) })
      .where(eq(crashRounds.id, round.id));
    this.emit({ type: 'phase', game: this.game });
  }

  private async fly(round: Round, now: number) {
    const crashed = now >= round.crashAt!;
    const multiplier = crashed ? round.crashPoint : crashMultiplierAt(now - round.startedAt!);
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
      .update(crashRounds)
      .set({ status: 'crashed', crashedAt: new Date(now) })
      .where(eq(crashRounds.id, round.id));
    if (lost.length > 0) {
      await this.db
        .update(crashBets)
        .set({ status: 'lost' })
        .where(
          inArray(
            crashBets.id,
            lost.map((bet) => bet.id),
          ),
        );
    }
    this.history = [
      { number: round.number, crashPoint: round.crashPoint, seed: round.seed },
      ...this.history,
    ].slice(0, HISTORY_SIZE);
    this.emit({ type: 'phase', game: this.game });
    for (const bet of lost) void this.settle(bet);
  }

  private async cash(bet: Bet, multiplier: number) {
    bet.status = 'cashed';
    bet.cashedAt = multiplier;
    bet.win = payout(bet.amount, multiplier);
    await this.db
      .update(crashBets)
      .set({ status: 'cashed', cashedAt: multiplier, win: bet.win })
      .where(eq(crashBets.id, bet.id));
    this.emit({ type: 'bets', game: this.game }, { type: 'mine', game: this.game, key: bet.key });
  }
}
