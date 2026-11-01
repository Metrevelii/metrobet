import {
  DEFAULT_CURRENCY,
  type ProductTotals,
  type Wallet,
  type WalletTransactionsPage,
} from '@metrobet/contracts';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, count, countDistinct, desc, eq, gte, inArray, sql, sum } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { IdempotencyConflictError } from './ledger-math.js';
import { Ledger } from './ledger.js';
import { walletAccounts, walletEntries, walletTransactions } from './wallet.schema.js';

/** Player-facing wallet: balance, history and (for now) dev deposits. Writes go through Ledger. */
@Injectable()
export class WalletService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(Ledger) private readonly ledger: Ledger,
  ) {}

  async getWallet(playerId: string): Promise<Wallet> {
    return { currency: DEFAULT_CURRENCY, balance: await this.ledger.playerBalance(playerId) };
  }

  /** The player's side of each transaction, newest first. */
  async listTransactions(
    playerId: string,
    page: number,
    pageSize: number,
  ): Promise<WalletTransactionsPage> {
    const playerAccount = and(
      eq(walletAccounts.kind, 'player'),
      eq(walletAccounts.playerId, playerId),
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: walletTransactions.id,
          type: walletTransactions.type,
          gameSlug: walletTransactions.gameSlug,
          amount: walletEntries.amount,
          balanceAfter: walletEntries.balanceAfter,
          createdAt: walletEntries.createdAt,
        })
        .from(walletEntries)
        .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
        .innerJoin(walletTransactions, eq(walletEntries.transactionId, walletTransactions.id))
        .where(playerAccount)
        .orderBy(desc(walletEntries.createdAt), desc(walletEntries.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ value: count() })
        .from(walletEntries)
        .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
        .where(playerAccount),
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  }

  /** Test money from the `funding` account. 409 when the key was used for another amount. */
  async deposit(playerId: string, amount: number, idempotencyKey: string): Promise<Wallet> {
    try {
      const { playerBalance } = await this.ledger.post({
        idempotencyKey,
        type: 'deposit',
        playerId,
        legs: [
          { account: { kind: 'funding' }, amount: -amount },
          { account: { kind: 'player', playerId }, amount },
        ],
      });
      return { currency: DEFAULT_CURRENCY, balance: playerBalance };
    } catch (error) {
      if (error instanceof IdempotencyConflictError) throw new ConflictException(error.message);
      throw error;
    }
  }

  /** Balances of many players at once (0 for players without an account yet). */
  async balances(playerIds: string[]): Promise<Map<string, number>> {
    if (playerIds.length === 0) return new Map();
    const rows = await this.db
      .select({ playerId: walletAccounts.playerId, balance: walletAccounts.balance })
      .from(walletAccounts)
      .where(and(eq(walletAccounts.kind, 'player'), inArray(walletAccounts.playerId, playerIds)));
    return new Map(rows.map((row) => [row.playerId!, row.balance]));
  }

  /** What the platform owes players right now: the sum of every player balance. */
  async totalPlayerBalances(): Promise<number> {
    const [row] = await this.db
      .select({ value: sum(walletAccounts.balance) })
      .from(walletAccounts)
      .where(eq(walletAccounts.kind, 'player'));
    return Number(row?.value ?? 0);
  }

  /**
   * Money totals since `since`, from the players' side of the ledger: per product (casino =
   * game wallet `game:*` transactions, sportsbook = `sportsbook:*`), plus deposits and the number
   * of players who placed a bet.
   */
  async totalsSince(since: Date): Promise<{
    casino: ProductTotals;
    sportsbook: ProductTotals;
    deposits: number;
    activePlayers: number;
  }> {
    const product = sql<string>`case when ${walletTransactions.idempotencyKey} like 'sportsbook:%' then 'sportsbook' else 'casino' end`;
    const playerEntries = and(
      eq(walletAccounts.kind, 'player'),
      gte(walletTransactions.createdAt, since),
    );
    const [rows, [active]] = await Promise.all([
      this.db
        .select({
          product,
          type: walletTransactions.type,
          amount: sum(walletEntries.amount),
          transactions: count(),
        })
        .from(walletEntries)
        .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
        .innerJoin(walletTransactions, eq(walletEntries.transactionId, walletTransactions.id))
        .where(playerEntries)
        .groupBy(product, walletTransactions.type),
      this.db
        .select({ value: countDistinct(walletTransactions.playerId) })
        .from(walletTransactions)
        .where(and(eq(walletTransactions.type, 'bet'), gte(walletTransactions.createdAt, since))),
    ]);
    const totals = (name: 'casino' | 'sportsbook'): ProductTotals => {
      const pick = (type: string) => rows.find((row) => row.product === name && row.type === type);
      const stakes = -Number(pick('bet')?.amount ?? 0);
      // A cash-out is money paid on a bet, like a win.
      const wins = Number(pick('win')?.amount ?? 0) + Number(pick('cashout')?.amount ?? 0);
      const refunds = Number(pick('rollback')?.amount ?? 0);
      return {
        stakes,
        wins,
        refunds,
        ggr: stakes - wins - refunds,
        bets: pick('bet')?.transactions ?? 0,
      };
    };
    const deposits = rows
      .filter((row) => row.type === 'deposit')
      .reduce((total, row) => total + Number(row.amount ?? 0), 0);
    return {
      casino: totals('casino'),
      sportsbook: totals('sportsbook'),
      deposits,
      activePlayers: active?.value ?? 0,
    };
  }
}
