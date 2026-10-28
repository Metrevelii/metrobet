import { DEFAULT_CURRENCY, type Wallet, type WalletTransactionsPage } from '@metrobet/contracts';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';

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
}
