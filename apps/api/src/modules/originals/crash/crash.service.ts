import { CRASH_GAMES, type CrashGame } from '@metrobet/contracts';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';

import type { Env } from '../../../config/env.js';
import { type Database, DRIZZLE } from '../../../database/database.tokens.js';
import { OriginalsWallet } from '../wallet/originals-wallet.js';
import { type Bet, CrashEngine, type CrashEvent } from './crash-engine.js';
import { crashBets, crashRounds } from './crash.schema.js';

const TICK_MS = 100;
const RECONCILE_MS = 60_000;

/**
 * Runs one CrashEngine per crash game (CRASH_GAMES) on a shared loop, and finishes bets that
 * are not live in any engine (`reconcile`, on boot and every minute).
 */
@Injectable()
export class CrashService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrashService.name);
  private readonly listeners = new Set<(event: CrashEvent) => void>();
  private readonly engines: Map<CrashGame, CrashEngine>;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(OriginalsWallet) private readonly wallet: OriginalsWallet,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {
    const emit = (...events: CrashEvent[]) => {
      for (const event of events) for (const listener of this.listeners) listener(event);
    };
    this.engines = new Map(
      CRASH_GAMES.map((game) => [game, new CrashEngine(game, db, wallet, emit)]),
    );
  }

  async onModuleInit() {
    for (const engine of this.engines.values()) await engine.recover();
    await this.reconcile();
    if (this.config.get('ORIGINALS_CRASH_LOOP', { infer: true }) === 'on') {
      this.timers.push(
        setInterval(() => void this.advance(Date.now()), TICK_MS),
        setInterval(() => void this.reconcile(), RECONCILE_MS),
      );
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
  }

  engine(game: CrashGame): CrashEngine {
    return this.engines.get(game)!;
  }

  on(listener: (event: CrashEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Advances every game to `now` (the loop, or tests by hand). */
  async advance(now: number) {
    await Promise.all([...this.engines.values()].map((engine) => engine.advance(now)));
  }

  /**
   * Finishes every unsettled bet that is not live in memory (after a restart, or a wallet call
   * that failed): refunds bets of rounds that never finished, closes lost ones, pays wins.
   */
  async reconcile(): Promise<void> {
    const live = new Set([...this.engines.values()].flatMap((engine) => engine.liveBetIds()));
    const rows = await this.db
      .select({ bet: crashBets, game: crashRounds.game, roundStatus: crashRounds.status })
      .from(crashBets)
      .innerJoin(crashRounds, eq(crashBets.roundId, crashRounds.id))
      .where(eq(crashBets.settled, false))
      .orderBy(crashBets.createdAt)
      .limit(100);
    for (const { bet: row, game, roundStatus } of rows) {
      if (live.has(row.id)) continue;
      const engine = this.engine(game);
      const bet: Bet = {
        id: row.id,
        roundId: row.roundId,
        token: row.sessionToken,
        key: row.playerKey,
        slot: row.slot as Bet['slot'],
        amount: row.amount,
        autoCashout: row.autoCashout,
        status: row.status === 'refunded' ? 'pending' : row.status,
        cashedAt: row.cashedAt,
        win: row.win,
      };
      const finished = roundStatus === 'crashed';
      const result =
        row.status === 'cashed' || row.status === 'lost' || (row.status === 'placed' && finished)
          ? await engine.settle(bet)
          : await engine.refund(bet);
      if (!result.ok && result.code !== null) {
        // The wallet will never accept it (e.g. a demo session lost on restart): stop retrying.
        this.logger.warn(`Crash bet ${row.id} given up: ${result.code}`);
        await this.db.update(crashBets).set({ settled: true }).where(eq(crashBets.id, row.id));
      }
    }
  }
}
