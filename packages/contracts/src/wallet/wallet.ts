import { z } from 'zod';

import { currencySchema } from '../common/currency.js';

/**
 * What moved money. `deposit`/`withdrawal` come from payments (dev deposits for now); `bet`,
 * `win` and `rollback` from games (the aggregator's wallet callbacks); `adjustment` from staff.
 */
export const WALLET_TRANSACTION_TYPES = [
  'deposit',
  'withdrawal',
  'bet',
  'win',
  'rollback',
  'adjustment',
] as const;
export const walletTransactionTypeSchema = z.enum(WALLET_TRANSACTION_TYPES);
export type WalletTransactionType = z.infer<typeof walletTransactionTypeSchema>;

/** The player's cash balance in minor units (tetri). */
export const walletSchema = z.object({
  currency: currencySchema,
  balance: z.number().int().min(0),
});
export type Wallet = z.infer<typeof walletSchema>;

/** One transaction as the player sees it. `amount` is signed: + credited, − debited. */
export const walletTransactionSchema = z.object({
  id: z.uuid(),
  type: walletTransactionTypeSchema,
  amount: z.number().int(),
  balanceAfter: z.number().int().min(0),
  /** The game for bets, wins and rollbacks. */
  gameSlug: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type WalletTransaction = z.infer<typeof walletTransactionSchema>;

export const WALLET_TRANSACTIONS_PAGE_SIZE = 20;

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(WALLET_TRANSACTIONS_PAGE_SIZE),
});

export const walletTransactionsPageSchema = z.object({
  items: z.array(walletTransactionSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type WalletTransactionsPage = z.infer<typeof walletTransactionsPageSchema>;

/** Development only: test money for the signed-in player, at most 1 000 ₾ per deposit. */
export const DEV_DEPOSIT_MAX = 1000_00;
export const devDepositInputSchema = z.object({
  amount: z.number().int().positive().max(DEV_DEPOSIT_MAX),
});
export type DevDepositInput = z.infer<typeof devDepositInputSchema>;
