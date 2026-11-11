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
  isPlayerOwned,
  type Leg,
  legsFingerprint,
  splitStake,
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
  row.kind === 'player' || row.kind === 'bonus'
    ? { kind: row.kind, playerId: row.playerId! }
    : { kind: row.kind };

export type StakeInput = {
  idempotencyKey: string;
  playerId: string;
  amount: number;
  gameSlug?: string | null;
};

export type PostedStake = Posted & { fromCash: number; fromBonus: number; bonusBalance: number };

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
      const created = await this.claim(tx, input);
      if (!created) return this.replay(tx, input);
      const accounts = await this.lockAccounts(
        tx,
        input.legs.map((leg) => leg.account),
      );
      const balances = await this.write(tx, created, input.legs, accounts);
      return {
        transactionId: created,
        replayed: false,
        playerBalance: balances.get(accountKey({ kind: 'player', playerId: input.playerId })) ?? 0,
      };
    });
  }

  /**
   * Debits a stake to the house: the player's cash first, then bonus money, decided under the
   * account locks. Idempotent like `post`; a replay reports the split of the first time.
   * Throws InsufficientFundsError when cash and bonus together don't cover it.
   */
  postStake(input: StakeInput, db: Database | Tx = this.db): Promise<PostedStake> {
    const { playerId, amount } = input;
    const cash: AccountRef = { kind: 'player', playerId };
    const bonus: AccountRef = { kind: 'bonus', playerId };
    return db.transaction(async (tx) => {
      const transaction = { ...input, type: 'bet' as const };
      const created = await this.claim(tx, transaction);
      if (!created) return this.replayStake(tx, input);
      const accounts = await this.lockAccounts(tx, [cash, bonus, { kind: 'house' }]);
      const { fromCash, fromBonus } = splitStake(
        amount,
        accounts.get(accountKey(cash))!.balance,
        accounts.get(accountKey(bonus))!.balance,
      );
      const legs: Leg[] = [
        ...(fromCash > 0 ? [{ account: cash, amount: -fromCash }] : []),
        ...(fromBonus > 0 ? [{ account: bonus, amount: -fromBonus }] : []),
        { account: { kind: 'house' }, amount },
      ];
      assertBalanced(legs, playerId);
      const balances = await this.write(tx, created, legs, accounts);
      return {
        transactionId: created,
        replayed: false,
        playerBalance: balances.get(accountKey(cash)) ?? accounts.get(accountKey(cash))!.balance,
        bonusBalance: balances.get(accountKey(bonus)) ?? accounts.get(accountKey(bonus))!.balance,
        fromCash,
        fromBonus,
      };
    });
  }

  /** What the player can bet with: cash plus bonus money (the balance players see). */
  async playableBalance(playerId: string, db: Pick<Database, 'select'> = this.db) {
    const [cash, bonus] = await Promise.all([
      this.playerBalance(playerId, db),
      this.bonusBalance(playerId, db),
    ]);
    return cash + bonus;
  }

  /** The player's bonus money (0 without an active bonus). */
  async bonusBalance(playerId: string, db: Pick<Database, 'select'> = this.db): Promise<number> {
    const [account] = await db
      .select({ balance: walletAccounts.balance })
      .from(walletAccounts)
      .where(this.refWhere({ kind: 'bonus', playerId }));
    return account?.balance ?? 0;
  }

  /** Inserts the transaction row; its id, or null when the key was posted before. */
  private async claim(
    tx: Tx,
    input: Pick<PostInput, 'idempotencyKey' | 'type' | 'playerId' | 'gameSlug'>,
  ): Promise<string | null> {
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
    return created?.id ?? null;
  }

  /** Applies `legs` to the locked accounts and stores the entries. New balances by account key. */
  private async write(
    tx: Tx,
    transactionId: string,
    legs: Leg[],
    accounts: Map<string, WalletAccountRow>,
  ): Promise<Map<string, number>> {
    const balances = applyLegs(
      legs,
      new Map([...accounts].map(([key, row]) => [key, row.balance])),
    );
    for (const [key, balance] of balances) {
      await tx
        .update(walletAccounts)
        .set({ balance })
        .where(eq(walletAccounts.id, accounts.get(key)!.id));
    }
    await tx.insert(walletEntries).values(
      legs.map(({ account, amount }) => ({
        transactionId,
        accountId: accounts.get(accountKey(account))!.id,
        amount,
        balanceAfter: balances.get(accountKey(account))!,
      })),
    );
    return balances;
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
          playerId: isPlayerOwned(ref) ? ref.playerId : null,
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
      isPlayerOwned(ref)
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

  /** Same stake key again: the first split, if it is the same stake (else 409). */
  private async replayStake(tx: Tx, input: StakeInput): Promise<PostedStake> {
    const [existing] = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey));
    const entries = await tx
      .select({ kind: walletAccounts.kind, amount: walletEntries.amount })
      .from(walletEntries)
      .innerJoin(walletAccounts, eq(walletEntries.accountId, walletAccounts.id))
      .where(eq(walletEntries.transactionId, existing!.id));
    const part = (kind: string) => -(entries.find((entry) => entry.kind === kind)?.amount ?? 0);
    const house = entries.find((entry) => entry.kind === 'house')?.amount;
    if (
      existing!.type !== 'bet' ||
      existing!.playerId !== input.playerId ||
      house !== input.amount
    ) {
      throw new IdempotencyConflictError(input.idempotencyKey);
    }
    return {
      transactionId: existing!.id,
      replayed: true,
      playerBalance: await this.playerBalance(input.playerId, tx),
      bonusBalance: await this.bonusBalance(input.playerId, tx),
      fromCash: part('player'),
      fromBonus: part('bonus'),
    };
  }
}
