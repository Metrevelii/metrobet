import {
  DEFAULT_CURRENCY,
  type GameWalletError,
  type GameWalletResponse,
  type gameWalletBalanceRequestSchema,
  type gameWalletBetRequestSchema,
  type gameWalletRollbackRequestSchema,
  type gameWalletWinRequestSchema,
} from '@metrobet/contracts';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { ActivityBus } from '../activity/activity-bus.js';
import { type GameSession, GameSessions } from '../casino/game-sessions.js';
import { PlayersService } from '../players/players.service.js';
import { IdempotencyConflictError, InsufficientFundsError } from '../wallet/ledger-math.js';
import { Ledger, type Tx } from '../wallet/ledger.js';
import {
  type GameRoundRow,
  gameRounds,
  type GameTransactionRow,
  gameTransactions,
} from './game-wallet.schema.js';

type BalanceRequest = z.output<typeof gameWalletBalanceRequestSchema>;
type BetRequest = z.output<typeof gameWalletBetRequestSchema>;
type WinRequest = z.output<typeof gameWalletWinRequestSchema>;
type RollbackRequest = z.output<typeof gameWalletRollbackRequestSchema>;

const STATUS: Record<GameWalletError, HttpStatus> = {
  INVALID_SIGNATURE: HttpStatus.UNAUTHORIZED,
  INVALID_REQUEST: HttpStatus.BAD_REQUEST,
  SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  SESSION_EXPIRED: HttpStatus.FORBIDDEN,
  PLAYER_BLOCKED: HttpStatus.FORBIDDEN,
  INSUFFICIENT_FUNDS: HttpStatus.PAYMENT_REQUIRED,
  DUPLICATE_TRANSACTION: HttpStatus.CONFLICT,
  TRANSACTION_ROLLED_BACK: HttpStatus.CONFLICT,
  ROUND_CLOSED: HttpStatus.CONFLICT,
  INVALID_ROLLBACK: HttpStatus.BAD_REQUEST,
};

/** A protocol error: `{ code, message }` body with the code's HTTP status. */
export const gameWalletError = (code: GameWalletError, message: string) =>
  new HttpException({ code, message }, STATUS[code]);

/** Ledger idempotency key for a provider transaction (unique across bets, wins and rollbacks). */
const ledgerKey = (externalId: string) => `game:${externalId}`;

type Settled = { balance: number; created: GameTransactionRow | null };

/**
 * Settles provider rounds against the wallet (see this module's CLAUDE.md for the rules).
 * Each call is one DB transaction: the game rows and the ledger movement commit together.
 */
@Injectable()
export class GameWalletService {
  private readonly logger = new Logger(GameWalletService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(GameSessions) private readonly sessions: GameSessions,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(ActivityBus) private readonly activity: ActivityBus,
  ) {}

  async balance({ sessionToken }: BalanceRequest): Promise<GameWalletResponse> {
    const session = await this.session(sessionToken);
    return this.response(await this.ledger.playerBalance(session.playerId));
  }

  async bet(request: BetRequest): Promise<GameWalletResponse> {
    const session = await this.session(request.sessionToken);
    if (session.expired) throw gameWalletError('SESSION_EXPIRED', 'The game session has expired');
    if ((await this.players.me(session.playerId)).status !== 'active') {
      throw gameWalletError('PLAYER_BLOCKED', 'The player cannot place bets');
    }

    const { balance, created } = await this.settle(async (tx) => {
      await this.lock(tx, request.transactionId);
      const existing = await this.findTransaction(tx, request.transactionId);
      if (existing) return this.replay(tx, existing, session, 'bet', request);
      if (await this.findRollbackOf(tx, request.transactionId)) {
        throw gameWalletError('TRANSACTION_ROLLED_BACK', 'This bet was already rolled back');
      }

      const round = await this.round(tx, session, request.roundId);
      if (round.status === 'closed') throw gameWalletError('ROUND_CLOSED', 'The round is closed');
      const posted = await this.ledger.post(
        {
          idempotencyKey: ledgerKey(request.transactionId),
          type: 'bet',
          playerId: session.playerId,
          gameSlug: session.gameSlug,
          legs: [
            { account: { kind: 'player', playerId: session.playerId }, amount: -request.amount },
            { account: { kind: 'house' }, amount: request.amount },
          ],
        },
        tx,
      );
      const row = await this.record(tx, round, {
        externalId: request.transactionId,
        kind: 'bet',
        amount: request.amount,
        walletTransactionId: posted.transactionId,
      });
      await tx
        .update(gameRounds)
        .set({ betTotal: sql`${gameRounds.betTotal} + ${request.amount}` })
        .where(eq(gameRounds.id, round.id));
      return { balance: posted.playerBalance, created: row };
    });

    if (created) await this.publishBet(session, created);
    return this.response(balance);
  }

  /** Wins settle even on an expired session: the bet was taken while it was valid. */
  async win(request: WinRequest): Promise<GameWalletResponse> {
    const session = await this.session(request.sessionToken);
    const { balance } = await this.settle(async (tx) => {
      await this.lock(tx, request.transactionId);
      const existing = await this.findTransaction(tx, request.transactionId);
      if (existing) return this.replay(tx, existing, session, 'win', request);

      const round = await this.round(tx, session, request.roundId);
      if (round.status === 'closed') throw gameWalletError('ROUND_CLOSED', 'The round is closed');
      const posted =
        request.amount > 0
          ? await this.ledger.post(
              {
                idempotencyKey: ledgerKey(request.transactionId),
                type: 'win',
                playerId: session.playerId,
                gameSlug: session.gameSlug,
                legs: [
                  { account: { kind: 'house' }, amount: -request.amount },
                  {
                    account: { kind: 'player', playerId: session.playerId },
                    amount: request.amount,
                  },
                ],
              },
              tx,
            )
          : null;
      const row = await this.record(tx, round, {
        externalId: request.transactionId,
        kind: 'win',
        amount: request.amount,
        walletTransactionId: posted?.transactionId ?? null,
      });
      await tx
        .update(gameRounds)
        .set({
          winTotal: sql`${gameRounds.winTotal} + ${request.amount}`,
          ...(request.roundClosed && { status: 'closed' as const, closedAt: new Date() }),
        })
        .where(eq(gameRounds.id, round.id));
      return {
        balance: posted?.playerBalance ?? (await this.ledger.playerBalance(session.playerId, tx)),
        created: row,
      };
    });
    return this.response(balance);
  }

  /**
   * Refunds a bet. Idempotent per rollback id, and a second rollback of the same bet is a
   * no-op. A rollback of an unknown bet is recorded, so that bet is refused if it arrives late.
   */
  async rollback(request: RollbackRequest): Promise<GameWalletResponse> {
    const session = await this.session(request.sessionToken);
    const { balance } = await this.settle(async (tx) => {
      // Same lock key as the bet itself, so a bet and its rollback never interleave.
      await this.lock(tx, request.rollbackOf);
      await this.lock(tx, request.transactionId);
      const existing = await this.findTransaction(tx, request.transactionId);
      if (existing) {
        if (existing.kind !== 'rollback' || existing.rollbackOf !== request.rollbackOf) {
          throw gameWalletError('DUPLICATE_TRANSACTION', 'Transaction id used for another call');
        }
        return this.current(tx, session);
      }
      if (await this.findRollbackOf(tx, request.rollbackOf)) return this.current(tx, session);

      const bet = await this.findTransaction(tx, request.rollbackOf);
      if (bet && (bet.kind !== 'bet' || bet.playerId !== session.playerId)) {
        throw gameWalletError('INVALID_ROLLBACK', 'Only a bet of this player can be rolled back');
      }
      const round = bet
        ? (await tx.select().from(gameRounds).where(eq(gameRounds.id, bet.roundId)))[0]!
        : await this.round(tx, session, request.roundId);
      const posted = bet
        ? await this.ledger.post(
            {
              idempotencyKey: ledgerKey(request.transactionId),
              type: 'rollback',
              playerId: session.playerId,
              gameSlug: session.gameSlug,
              legs: [
                { account: { kind: 'house' }, amount: -bet.amount },
                { account: { kind: 'player', playerId: session.playerId }, amount: bet.amount },
              ],
            },
            tx,
          )
        : null;
      const row = await this.record(tx, round, {
        externalId: request.transactionId,
        kind: 'rollback',
        amount: bet?.amount ?? 0,
        rollbackOf: request.rollbackOf,
        walletTransactionId: posted?.transactionId ?? null,
      });
      if (bet) {
        await tx
          .update(gameRounds)
          .set({ betTotal: sql`${gameRounds.betTotal} - ${bet.amount}` })
          .where(eq(gameRounds.id, round.id));
      }
      return {
        balance: posted?.playerBalance ?? (await this.ledger.playerBalance(session.playerId, tx)),
        created: row,
      };
    });
    return this.response(balance);
  }

  private async session(token: string): Promise<GameSession> {
    const session = await this.sessions.resolve(token);
    if (!session) throw gameWalletError('SESSION_NOT_FOUND', 'Unknown game session');
    return session;
  }

  /** Runs `work` in one DB transaction and maps ledger errors to protocol errors. */
  private async settle(work: (tx: Tx) => Promise<Settled>): Promise<Settled> {
    try {
      return await this.db.transaction(work);
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw gameWalletError('INSUFFICIENT_FUNDS', 'Not enough balance for this bet');
      }
      if (error instanceof IdempotencyConflictError) {
        throw gameWalletError('DUPLICATE_TRANSACTION', 'Transaction id used for another call');
      }
      throw error;
    }
  }

  /** Serializes work on one provider transaction id until this DB transaction ends. */
  private async lock(tx: Tx, externalId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`game-tx:${externalId}`}))`);
  }

  private async findTransaction(tx: Tx, externalId: string) {
    const [row] = await tx
      .select()
      .from(gameTransactions)
      .where(eq(gameTransactions.externalId, externalId));
    return row ?? null;
  }

  private async findRollbackOf(tx: Tx, betExternalId: string) {
    const [row] = await tx
      .select({ id: gameTransactions.id })
      .from(gameTransactions)
      .where(eq(gameTransactions.rollbackOf, betExternalId));
    return row ?? null;
  }

  /** The round for this game + provider round id, created on first use and locked. */
  private async round(tx: Tx, session: GameSession, externalId: string): Promise<GameRoundRow> {
    await tx
      .insert(gameRounds)
      .values({
        sessionId: session.id,
        playerId: session.playerId,
        gameSlug: session.gameSlug,
        externalId,
      })
      .onConflictDoNothing();
    const [round] = await tx
      .select()
      .from(gameRounds)
      .where(and(eq(gameRounds.gameSlug, session.gameSlug), eq(gameRounds.externalId, externalId)))
      .for('update');
    if (round!.playerId !== session.playerId) {
      throw gameWalletError('INVALID_REQUEST', 'The round belongs to another player');
    }
    return round!;
  }

  private async record(
    tx: Tx,
    round: GameRoundRow,
    values: Pick<
      typeof gameTransactions.$inferInsert,
      'externalId' | 'kind' | 'amount' | 'rollbackOf' | 'walletTransactionId'
    >,
  ): Promise<GameTransactionRow> {
    const [row] = await tx
      .insert(gameTransactions)
      .values({ ...values, roundId: round.id, playerId: round.playerId })
      .returning();
    return row!;
  }

  /** The same transaction id again: fine if it is the same call (nothing moves), else 409. */
  private async replay(
    tx: Tx,
    existing: GameTransactionRow,
    session: GameSession,
    kind: 'bet' | 'win',
    request: { roundId: string; amount: number },
  ): Promise<Settled> {
    const [round] = await tx
      .select({ externalId: gameRounds.externalId })
      .from(gameRounds)
      .where(eq(gameRounds.id, existing.roundId));
    const same =
      existing.kind === kind &&
      existing.playerId === session.playerId &&
      existing.amount === request.amount &&
      round?.externalId === request.roundId;
    if (!same) {
      throw gameWalletError('DUPLICATE_TRANSACTION', 'Transaction id used for another call');
    }
    return this.current(tx, session);
  }

  private async current(tx: Tx, session: GameSession): Promise<Settled> {
    return { balance: await this.ledger.playerBalance(session.playerId, tx), created: null };
  }

  private response(balance: number): GameWalletResponse {
    return { balance, currency: DEFAULT_CURRENCY };
  }

  /** Promotions and other subscribers count real bets. A failure never undoes the bet. */
  private async publishBet(session: GameSession, bet: GameTransactionRow) {
    try {
      await this.activity.publish({
        id: `game:${bet.externalId}`,
        kind: 'casino.bet',
        playerId: session.playerId,
        occurredAt: bet.createdAt.toISOString(),
        amount: bet.amount,
        currency: DEFAULT_CURRENCY,
        gameSlug: session.gameSlug,
        gameType: session.gameType,
      });
    } catch (error) {
      this.logger.error(`Failed to publish bet ${bet.externalId}`, error);
    }
  }
}
