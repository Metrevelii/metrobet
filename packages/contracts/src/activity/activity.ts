import { z } from 'zod';

import { gameTypeSchema } from '../casino/casino.js';
import { currencySchema } from '../common/currency.js';
import { minorAmountSchema } from '../common/money.js';
import { slugSchema } from '../common/slug.js';
import { sportSchema } from '../sportsbook/sportsbook.js';

/**
 * Player activity published on the API's activity bus: what promotions (wager progress,
 * leaderboards…) react to. Each event has a producer-unique `id` (e.g. the aggregator's
 * transaction id), so publishing the same event twice is a no-op.
 */
export const casinoBetActivitySchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.literal('casino.bet'),
  playerId: z.uuid(),
  occurredAt: z.iso.datetime(),
  /** Stake in minor units. */
  amount: minorAmountSchema,
  currency: currencySchema,
  gameSlug: slugSchema,
  gameType: gameTypeSchema,
});
export type CasinoBetActivity = z.infer<typeof casinoBetActivitySchema>;

/** A sportsbook ticket was placed (one per ticket; a combo counts once). */
export const sportsBetActivitySchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.literal('sports.bet'),
  playerId: z.uuid(),
  occurredAt: z.iso.datetime(),
  /** Stake in minor units. */
  amount: minorAmountSchema,
  currency: currencySchema,
  mode: z.enum(['single', 'combo']),
  /** Total decimal odds of the ticket. */
  odds: z.number(),
  sports: z.array(sportSchema).min(1),
});
export type SportsBetActivity = z.infer<typeof sportsBetActivitySchema>;

export const activityEventSchema = z.discriminatedUnion('kind', [
  casinoBetActivitySchema,
  sportsBetActivitySchema,
]);
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export type ActivityKind = ActivityEvent['kind'];

/** Development only: simulate a casino bet for the signed-in player (no wallet yet). */
export const devCasinoBetInputSchema = z.object({
  gameSlug: slugSchema,
  amount: minorAmountSchema.max(10_000_00),
});
export type DevCasinoBetInput = z.infer<typeof devCasinoBetInputSchema>;
