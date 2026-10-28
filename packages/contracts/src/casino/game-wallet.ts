import { z } from 'zod';

import { currencySchema } from '../common/currency.js';
import { minorAmountSchema } from '../common/money.js';

/**
 * Game wallet protocol ("seamless wallet"): how a game provider settles real-money rounds with
 * us, server to server. Every request is a JSON POST signed with HMAC-SHA256 of the raw body
 * (hex) in `GAME_WALLET_SIGNATURE_HEADER`. Amounts are minor units. A contracted aggregator's
 * own protocol gets an adapter that maps onto the same operations.
 */
export const GAME_WALLET_SIGNATURE_HEADER = 'x-game-wallet-signature';

export const GAME_WALLET_OPERATIONS = ['balance', 'bet', 'win', 'rollback'] as const;
export type GameWalletOperation = (typeof GAME_WALLET_OPERATIONS)[number];

const externalId = z.string().min(1).max(100);
const session = { sessionToken: z.string().min(1).max(200) };

export const gameWalletBalanceRequestSchema = z.object(session);

/** Takes `amount` from the player. Refused after the session expires. */
export const gameWalletBetRequestSchema = z.object({
  ...session,
  transactionId: externalId,
  roundId: externalId,
  amount: minorAmountSchema,
  currency: currencySchema,
});

/** Pays `amount` (0 = lost round) and, by default, closes the round. */
export const gameWalletWinRequestSchema = z.object({
  ...session,
  transactionId: externalId,
  roundId: externalId,
  amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: currencySchema,
  roundClosed: z.boolean().default(true),
});

/** Refunds the bet `rollbackOf`. Unknown bets are remembered, so a late copy is refused. */
export const gameWalletRollbackRequestSchema = z.object({
  ...session,
  transactionId: externalId,
  roundId: externalId,
  rollbackOf: externalId,
});

export type GameWalletBetRequest = z.input<typeof gameWalletBetRequestSchema>;
export type GameWalletWinRequest = z.input<typeof gameWalletWinRequestSchema>;
export type GameWalletRollbackRequest = z.input<typeof gameWalletRollbackRequestSchema>;

/** Every successful call returns the player's balance after it. Replays return the current one. */
export const gameWalletResponseSchema = z.object({
  balance: z.number().int().min(0),
  currency: currencySchema,
});
export type GameWalletResponse = z.infer<typeof gameWalletResponseSchema>;

export const GAME_WALLET_ERRORS = [
  'INVALID_SIGNATURE',
  'INVALID_REQUEST',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'PLAYER_BLOCKED',
  'INSUFFICIENT_FUNDS',
  'DUPLICATE_TRANSACTION',
  'TRANSACTION_ROLLED_BACK',
  'ROUND_CLOSED',
  'INVALID_ROLLBACK',
] as const;
export type GameWalletError = (typeof GAME_WALLET_ERRORS)[number];

/** Error body (with a 4xx status). `code` is what providers branch on. */
export const gameWalletErrorSchema = z.object({
  code: z.enum(GAME_WALLET_ERRORS),
  message: z.string(),
});
export type GameWalletErrorBody = z.infer<typeof gameWalletErrorSchema>;
