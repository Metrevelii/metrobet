import { z } from 'zod';

import { betModeSchema } from '../sportsbook/bets.js';

/**
 * The player's private live channel (Socket.IO): balance changes and settled tickets, pushed the
 * moment they commit. The browser never sees the session token: it asks the site for a one-time
 * `PlayerSocketPass` and connects with `auth: { pass }`.
 */
export const PLAYER_WS_NAMESPACE = '/player';

export const PLAYER_WS = {
  /** `{ balance }` after any change to the player's balance (minor units). */
  balance: 'balance',
  /** `TicketSettledMessage` when one of the player's sports tickets is won, lost or void. */
  ticketSettled: 'ticket:settled',
} as const;

/** One-time pass for opening the channel (60 s, single use). */
export const playerSocketPassSchema = z.object({ pass: z.string().min(1) });
export type PlayerSocketPass = z.infer<typeof playerSocketPassSchema>;

export const playerBalanceMessageSchema = z.object({ balance: z.number().int().min(0) });
export type PlayerBalanceMessage = z.infer<typeof playerBalanceMessageSchema>;

export const ticketSettledMessageSchema = z.object({
  ticketId: z.uuid(),
  status: z.enum(['won', 'lost', 'void']),
  mode: betModeSchema,
  stake: z.number().int(),
  payout: z.number().int(),
});
export type TicketSettledMessage = z.infer<typeof ticketSettledMessageSchema>;
