import { DEFAULT_CURRENCY, type WalletTransactionType } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import {
  type AccountRef,
  accountKey,
  applyLegs,
  assertBalanced,
  IdempotencyConflictError,
  type Leg,
  legsFingerprint,
} from './ledger-math.js';
import {
  type WalletAccountRow,
  walletAccounts,
  walletEntries,
  walletTransactions,
} from './wallet.schema.js';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type PostInput = {
  /** Unique per real-world operation (aggregator tx id, payment id…). See CLAUDE.md #6. */
  idempotencyKey: string;
  type: WalletTransactionType;
  playerId: string;
  gameSlug?: string | null;
  legs: Leg[];
};

export type Posted = {
  transactionId: string;
  /** True when the key was posted before: nothing moved this time. */
  replayed: boolean;
  /** The player's balance after the transaction (current balance on a replay). */
  playerBalance: number;
};

const currency = DEFAULT_CURRENCY;

const fromRow = (row: Pick<WalletAccountRow, 'kind' | 'playerId'>): AccountRef =>
  row.kind === 'player' ? { kind: 'player', playerId: row.playerId! } : { kind: row.kind };

/**
 * The only writer of the wallet tables. `post` moves money between accounts atomically,
 * idempotently and without overspending (invariants in this module's CLAUDE.md).
 * Throws InsufficientFundsError / IdempotencyConflictError; callers map them to HTTP.
 */
@Injectable()
export class Ledger {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Pass the caller's transaction as `db` to commit the money movement together with the
   * caller's own rows (it then runs in a savepoint).
   */
  post(input: PostInput, db: Database | Tx = this.db): Promise<Posted> {
    assertBalanced(input.legs, input.playerId);
    return db.transaction(async (tx) => {
      // A concurrent post with the same key waits on the unique index, then sees it as taken.
      const [created] = await tx
        .insert(walletTransactions)
        .values({
          idempotencyKey: input.idempotencyKey,
          type: input.type,
          playerId: input.playerId,
          gameSlug: input.gameSlug ?? null,
        })
        .onConflictDoNothing({ target: walletTransactions.idempotencyKey })
        .returning({ id: walletTransactions.id });
      if (!created) return this.replay(tx, input);

      const accounts = await this.lockAccounts(
        tx,
        input.legs.map((leg) => leg.account),
      );
      const balances = applyLegs(
        input.legs,
        new Map([...accounts].map(([key, row]) => [key, row.balance])),
      );

      for (const [key, balance] of balances) {
        await tx
          .update(walletAccounts)
          .set({ balance })
          .where(eq(walletAccounts.id, accounts.get(key)!.id));
      }
      await tx.insert(walletEntries).values(
        input.legs.map(({ account, amount }) => ({
          transactionId: created.id,
          accountId: accounts.get(accountKey(account))!.id,
          amount,
          balanceAfter: balances.get(accountKey(account))!,
        })),
      );

      return {
        transactionId: created.id,
        replayed: false,
        playerBalance: balances.get(accountKey({ kind: 'player', playerId: input.playerId })) ?? 0,
      };
    });
  }

  /** The player's cash balance (0 before their first transaction). */
  async playerBalance(playerId: string, db: Pick<Database, 'select'> = this.db): Promise<number> {
    const [account] = await db
      .select({ balance: walletAccounts.balance })
      .from(walletAccounts)
      .where(this.refWhere({ kind: 'player', playerId }));
    return account?.balance ?? 0;
  }

  /** Creates missing accounts, then locks all of them in id order (CLAUDE.md #7). */
  private async lockAccounts(tx: Tx, refs: AccountRef[]) {
    await tx
      .insert(walletAccounts)
      .values(
        refs.map((ref) => ({
          kind: ref.kind,
          playerId: ref.kind === 'player' ? ref.playerId : null,
          currency,
        })),
      )
      .onConflictDoNothing();
    const rows = await tx
      .select()
      .from(walletAccounts)
      .where(or(...refs.map((ref) => this.refWhere(ref))))
      .orderBy(walletAccounts.id)
      .for('update');
    return new Map(rows.map((row) => [accountKey(fromRow(row)), row]));
  }

  private refWhere(ref: AccountRef) {
    return and(
      eq(walletAccounts.kind, ref.kind),
      ref.kind === 'player'
        ? eq(walletAccounts.playerId, ref.playerId)
        : isNull(walletAccounts.playerId),
      eq(walletAccounts.currency, currency),
    );
  }

  /** Same key again: return the first result if it is the same transaction, else 409. */
  private async replay(tx: Tx, input: PostInput): Promise<Posted> {
    const [existing] = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey));
    const entries = await tx
      .select({
        kind: walletAccounts.kind,
        playerId: walletAccounts.playerId,
        amount: walletEntries.amount,
      })
      .from(walletEntries)
      .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
      .where(eq(walletEntries.transactionId, existing!.id));
    const same =
      existing!.type === input.type &&
      existing!.playerId === input.playerId &&
      legsFingerprint(
        entries.map((entry) => ({ account: fromRow(entry), amount: entry.amount })),
      ) === legsFingerprint(input.legs);
    if (!same) throw new IdempotencyConflictError(input.idempotencyKey);
    return {
      transactionId: existing!.id,
      replayed: true,
      playerBalance: await this.playerBalance(input.playerId, tx),
    };
  }
}
