import { z } from 'zod';

/**
 * Bonus money: a separate balance with a wagering requirement and an expiry. Bets spend cash
 * first, then bonus money; the bonus becomes cash once `wagered` reaches `wageringRequired`.
 * Amounts are minor units.
 */

/** `completed`: wagering done, converted to cash · `forfeited`: given up for a withdrawal ·
 * `expired`: time ran out · `cancelled`: by staff. Only one bonus is active per player. */
export const BONUS_STATUSES = ['active', 'completed', 'forfeited', 'expired', 'cancelled'] as const;
export const bonusStatusSchema = z.enum(BONUS_STATUSES);
export type BonusStatus = z.infer<typeof bonusStatusSchema>;

/** Sports tickets count towards wagering only at these total odds or more. Casino bets always count. */
export const BONUS_SPORTS_MIN_ODDS = 1.5;

export const bonusSchema = z.object({
  id: z.uuid(),
  status: bonusStatusSchema,
  /** What was granted. */
  amount: z.number().int().positive(),
  /** Bonus money left right now (active bonuses; 0 once it ended). */
  balance: z.number().int().min(0),
  wageringRequired: z.number().int().min(0),
  wagered: z.number().int().min(0),
  expiresAt: z.iso.datetime(),
  /** Name of the promotion that granted it, in the reader's language (null for staff grants). */
  title: z.string().nullable(),
  /** Why it ended early (forfeited / cancelled). */
  reason: z.string().nullable(),
  /** Money that became cash on completion. */
  converted: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type Bonus = z.infer<typeof bonusSchema>;

export const playerBonusesSchema = z.object({
  active: bonusSchema.nullable(),
  history: z.array(bonusSchema),
});
export type PlayerBonuses = z.infer<typeof playerBonusesSchema>;

export const adminBonusSchema = bonusSchema.extend({ playerId: z.uuid() });
export type AdminBonus = z.infer<typeof adminBonusSchema>;
export const adminBonusesSchema = z.array(adminBonusSchema);

export const bonusCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});
export type BonusCancel = z.infer<typeof bonusCancelSchema>;
