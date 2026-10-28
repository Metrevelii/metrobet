import { WALLET_TRANSACTION_TYPES } from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

/** See CLAUDE.md for the ledger invariants these tables (and the 0008 triggers) enforce. */
export const WALLET_ACCOUNT_KINDS = ['player', 'house', 'funding'] as const;
export type WalletAccountKind = (typeof WALLET_ACCOUNT_KINDS)[number];

export const walletAccountKind = pgEnum('wallet_account_kind', WALLET_ACCOUNT_KINDS);
export const walletTransactionType = pgEnum('wallet_transaction_type', WALLET_TRANSACTION_TYPES);

const minor = () => bigint({ mode: 'number' });

export const walletAccounts = pgTable(
  'wallet_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: walletAccountKind().notNull(),
    playerId: uuid().references(() => players.id),
    currency: text().notNull(),
    /** Cache of the sum of this account's entries, updated with them. */
    balance: minor().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('wallet_accounts_owner_unique')
      .on(table.kind, table.playerId, table.currency)
      .nullsNotDistinct(),
    check(
      'wallet_accounts_owner_check',
      sql`(${table.kind} = 'player') = (${table.playerId} is not null)`,
    ),
    check(
      'wallet_accounts_player_balance_check',
      sql`${table.kind} <> 'player' or ${table.balance} >= 0`,
    ),
  ],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    idempotencyKey: text().notNull().unique('wallet_transactions_idempotency_key_unique'),
    type: walletTransactionType().notNull(),
    /** The player whose money moved (every transaction today involves exactly one player). */
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    gameSlug: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('wallet_transactions_player_idx').on(table.playerId, table.createdAt)],
);

export const walletEntries = pgTable(
  'wallet_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    transactionId: uuid()
      .notNull()
      .references(() => walletTransactions.id),
    accountId: uuid()
      .notNull()
      .references(() => walletAccounts.id),
    /** Signed: + credits the account, − debits it. */
    amount: minor().notNull(),
    balanceAfter: minor().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('wallet_entries_amount_check', sql`${table.amount} <> 0`),
    index('wallet_entries_account_idx').on(table.accountId, table.createdAt),
    index('wallet_entries_transaction_idx').on(table.transactionId),
  ],
);

export type WalletAccountRow = typeof walletAccounts.$inferSelect;
