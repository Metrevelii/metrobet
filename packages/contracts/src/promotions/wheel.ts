import { z } from 'zod';

/** The signed-in player's progress on one wheel block. Amounts are minor units. */
export const wheelStateSchema = z.object({
  /** False when the promotion needs opt-in and the player has not joined: nothing counts yet. */
  eligible: z.boolean(),
  wagered: z.number().int().nonnegative(),
  spinsAvailable: z.number().int().nonnegative(),
  spinsUsed: z.number().int().nonnegative(),
  /** Still to wager for the next spin. */
  toNextSpin: z.number().int().positive(),
  /** Latest wins, newest first. */
  wins: z.array(z.object({ freeSpins: z.number().int().positive(), wonAt: z.iso.datetime() })),
});
export type WheelState = z.infer<typeof wheelStateSchema>;

export const wheelSpinResultSchema = z.object({
  /** Index into the block's segments: the client animates the wheel to it. */
  segmentIndex: z.number().int().nonnegative(),
  freeSpins: z.number().int().positive(),
  state: wheelStateSchema,
});
export type WheelSpinResult = z.infer<typeof wheelSpinResultSchema>;

export const WHEEL_WINS_SHOWN = 10;
