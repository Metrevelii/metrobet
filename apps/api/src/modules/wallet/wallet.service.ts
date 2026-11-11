import {
  DEFAULT_CURRENCY,
  type ProductTotals,
  type Wallet,
  type WalletTransactionType,
  type WalletTransactionsPage,
} from '@metrobet/contracts';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  type SQL,
  sql,
  sum,
} from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { IdempotencyConflictError } from './ledger-math.js';
import { Ledger } from './ledger.js';
import { walletAccounts, walletEntries, walletTransactions } from './wallet.schema.js';

/** A player's money flow over a window, minor units (all ≥ 0 except as noted). */
export type PlayerActivityTotals = {
  deposits: number;
  /** Bets minus refunded (rolled-back) bets. */
  stakes: number;
  /** Wins and cash-outs. */
  returns: number;
};

/** Player-facing wallet: balance, history and (for now) dev deposits. Writes go through Ledger. */
@Injectable()
export class WalletService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(Ledger) private readonly ledger: Ledger,
  ) {}

  async getWallet(playerId: string): Promise<Wallet> {
    const [balance, bonusBalance] = await Promise.all([
      this.ledger.playerBalance(playerId),
      this.ledger.bonusBalance(playerId),
    ]);
    return { currency: DEFAULT_CURRENCY, balance, bonusBalance };
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
      return {
        currency: DEFAULT_CURRENCY,
        balance: playerBalance,
        bonusBalance: await this.ledger.bonusBalance(playerId),
      };
    } catch (error) {
      if (error instanceof IdempotencyConflictError) throw new ConflictException(error.message);
      throw error;
    }
  }

  /**
   * The player's deposits, stakes and returns since each of `windows` (one result per window,
   * same order), in one query. Responsible-gaming limits and the reality check count with it.
   */
  async playerActivity(playerId: string, windows: Date[]): Promise<PlayerActivityTotals[]> {
    if (windows.length === 0) return [];
    const earliest = new Date(Math.min(...windows.map((since) => since.getTime())));
    const columns: Record<string, SQL<string>> = Object.fromEntries(
      windows.map((since, index) => [
        `w${index}`,
        sql<string>`coalesce(sum(${walletEntries.amount}) filter (where ${walletTransactions.createdAt} >= ${since.toISOString()}::timestamptz), 0)`,
      ]),
    );
    const rows = await this.db
      .select({ type: walletTransactions.type, ...columns })
      .from(walletEntries)
      .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
      .innerJoin(walletTransactions, eq(walletEntries.transactionId, walletTransactions.id))
      .where(
        and(
          eq(walletTransactions.playerId, playerId),
          // Cash and bonus money both count: a bet paid with bonus money is still a stake.
          inArray(walletAccounts.kind, ['player', 'bonus']),
          gte(walletTransactions.createdAt, earliest),
        ),
      )
      .groupBy(walletTransactions.type);
    return windows.map((_, index) => {
      // The player's side: bets are negative, refunds, wins and deposits positive.
      const total = (type: WalletTransactionType) =>
        Number(
          (rows.find((row) => row.type === type) as Record<string, unknown>)?.[`w${index}`] ?? 0,
        );
      return {
        deposits: total('deposit'),
        stakes: Math.max(0, -total('bet') - total('rollback')),
        returns: total('win') + total('cashout'),
      };
    });
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

  /** Players holding bonus money (for the bonus module's stray-money sweep). */
  async bonusHolders(): Promise<string[]> {
    const rows = await this.db
      .select({ playerId: walletAccounts.playerId })
      .from(walletAccounts)
      .where(and(eq(walletAccounts.kind, 'bonus'), gt(walletAccounts.balance, 0)));
    return rows.map((row) => row.playerId!);
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
   * game wallet `game:*` transactions, sportsbook = `sportsbook:*`), plus deposits, bonus money
   * converted to cash and the number of players who placed a bet. Stakes and wins include the
   * bonus-money part.
   */
  async totalsSince(since: Date): Promise<{
    casino: ProductTotals;
    sportsbook: ProductTotals;
    deposits: number;
    bonusCost: number;
    activePlayers: number;
  }> {
    const product = sql<string>`case when ${walletTransactions.idempotencyKey} like 'sportsbook:%' then 'sportsbook' else 'casino' end`;
    const playerEntries = and(
      inArray(walletAccounts.kind, ['player', 'bonus']),
      gte(walletTransactions.createdAt, since),
    );
    const [rows, [active]] = await Promise.all([
      this.db
        .select({
          product,
          type: walletTransactions.type,
          amount: sum(walletEntries.amount),
          // A bet paid with cash and bonus money has two entries: count transactions.
          transactions: countDistinct(walletEntries.transactionId),
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
    const sumOf = (type: string) =>
      rows
        .filter((row) => row.type === type)
        .reduce((total, row) => total + Number(row.amount ?? 0), 0);
    return {
      casino: totals('casino'),
      sportsbook: totals('sportsbook'),
      deposits: sumOf('deposit'),
      // A conversion moves bonus → cash: its player-side entries sum to 0, so take the cash leg.
      bonusCost: await this.convertedSince(since),
      activePlayers: active?.value ?? 0,
    };
  }

  private async convertedSince(since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: sum(walletEntries.amount) })
      .from(walletEntries)
      .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
      .innerJoin(walletTransactions, eq(walletEntries.transactionId, walletTransactions.id))
      .where(
        and(
          eq(walletTransactions.type, 'bonus_convert'),
          eq(walletAccounts.kind, 'player'),
          gte(walletTransactions.createdAt, since),
        ),
      );
    return Number(row?.value ?? 0);
  }
}
