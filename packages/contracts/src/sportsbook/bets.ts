import { z } from 'zod';

import { minorAmountSchema } from '../common/money.js';
import { marketTypeSchema, selectionKeySchema, sportSchema } from './sportsbook.js';

/**
 * Sportsbook tickets: placing bets from the betslip, and the player's bet history. Stakes and
 * payouts are minor units; odds are decimal with 2 decimals.
 */
export const BET_LIMITS = {
  /** 0.10 ₾ */
  minStake: 10,
  /** 1 000 ₾ per ticket */
  maxStake: 1000_00,
  /** 100 000 ₾ potential win per ticket */
  maxPayout: 100_000_00,
  maxSelections: 20,
} as const;

export const BET_MODES = ['single', 'combo'] as const;
export const betModeSchema = z.enum(BET_MODES);
export type BetMode = z.infer<typeof betModeSchema>;

export const betRequestSelectionSchema = z.object({
  selectionId: z.string().min(1).max(200),
  /** The odds the player saw and accepted. */
  odds: z.number().min(1.01).max(1000),
});

/**
 * One betslip submission. `single`: one ticket per selection, `stakes[i]` for `selections[i]`;
 * `combo`: one accumulator ticket, `stakes` = [stake], two or more different events.
 * Retrying with the same `idempotencyKey` returns the tickets already placed.
 */
export const placeBetsRequestSchema = z
  .object({
    idempotencyKey: z.uuid(),
    mode: betModeSchema,
    selections: z.array(betRequestSelectionSchema).min(1).max(BET_LIMITS.maxSelections),
    stakes: z.array(minorAmountSchema).min(1).max(BET_LIMITS.maxSelections),
    /** Take a higher current price automatically (a lower one always needs confirmation). */
    acceptHigherOdds: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const ids = value.selections.map((selection) => selection.selectionId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['selections'], message: 'Duplicate selection' });
    }
    if (value.mode === 'single' && value.stakes.length !== value.selections.length) {
      ctx.addIssue({ code: 'custom', path: ['stakes'], message: 'One stake per selection' });
    }
    if (value.mode === 'combo' && (value.stakes.length !== 1 || value.selections.length < 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['stakes'],
        message: 'A combo has one stake and 2+ selections',
      });
    }
  });
export type PlaceBetsRequest = z.input<typeof placeBetsRequestSchema>;

export const TICKET_STATUSES = ['open', 'won', 'lost', 'void'] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const SELECTION_RESULTS = ['won', 'lost', 'void'] as const;
export const selectionResultSchema = z.enum(SELECTION_RESULTS);
export type SelectionResult = z.infer<typeof selectionResultSchema>;

/** A selection as placed: a snapshot, so history renders after the event left the feed. */
export const ticketSelectionSchema = z.object({
  selectionId: z.string(),
  eventId: z.string(),
  sport: sportSchema,
  competition: z.string(),
  home: z.string(),
  away: z.string(),
  startsAt: z.iso.datetime(),
  marketType: marketTypeSchema,
  line: z.number().nullable(),
  selectionKey: selectionKeySchema,
  odds: z.number(),
  /** null while the outcome is not known yet. */
  result: selectionResultSchema.nullable(),
});
export type TicketSelection = z.infer<typeof ticketSelectionSchema>;

export const ticketSchema = z.object({
  id: z.uuid(),
  mode: betModeSchema,
  stake: z.number().int(),
  /** Total odds at placement (product of the selections, 2 decimals). */
  odds: z.number(),
  potentialWin: z.number().int(),
  status: ticketStatusSchema,
  /** Paid amount once settled (win, or the stake back for a void ticket). */
  payout: z.number().int(),
  placedAt: z.iso.datetime(),
  settledAt: z.iso.datetime().nullable(),
  selections: z.array(ticketSelectionSchema),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const placeBetsResponseSchema = z.object({
  tickets: z.array(ticketSchema),
  balance: z.number().int(),
});
export type PlaceBetsResponse = z.infer<typeof placeBetsResponseSchema>;

export const TICKETS_PAGE_SIZE = 20;
export const ticketsQuerySchema = z.object({
  /** `open` or `settled` (won, lost, void); all when omitted. */
  status: z.enum(['open', 'settled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(TICKETS_PAGE_SIZE),
});
export type TicketsQuery = z.input<typeof ticketsQuerySchema>;

export const ticketsPageSchema = z.object({
  items: z.array(ticketSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type TicketsPage = z.infer<typeof ticketsPageSchema>;

export const BET_ERRORS = [
  /** A price went down (or up without acceptHigherOdds): see `selections` for current odds. */
  'ODDS_CHANGED',
  /** Event started/ended, market suspended or closed, or selection unknown. */
  'SELECTION_UNAVAILABLE',
  /** A combo with two selections from the same event. */
  'SAME_EVENT',
  'STAKE_TOO_LOW',
  'STAKE_TOO_HIGH',
  'PAYOUT_TOO_HIGH',
  'INSUFFICIENT_FUNDS',
  'PLAYER_BLOCKED',
  /** The idempotency key was already used for another request. */
  'DUPLICATE_REQUEST',
] as const;
export type BetError = (typeof BET_ERRORS)[number];

export const betErrorSchema = z.object({
  code: z.enum(BET_ERRORS),
  message: z.string(),
  /** For ODDS_CHANGED / SELECTION_UNAVAILABLE: the selections concerned (current odds or null). */
  selections: z
    .array(z.object({ selectionId: z.string(), odds: z.number().nullable() }))
    .optional(),
});
export type BetErrorBody = z.infer<typeof betErrorSchema>;

/** Total odds of a ticket: product of the selections, rounded down to 2 decimals. */
export const comboOdds = (odds: readonly number[]) =>
  Math.floor(odds.reduce((product, value) => product * value, 1) * 100 + 1e-6) / 100;

/** Payout for a stake at decimal odds, in whole minor units (rounded down). */
export const payoutFor = (stake: number, odds: number) =>
  Math.floor((stake * Math.round(odds * 100)) / 100);
