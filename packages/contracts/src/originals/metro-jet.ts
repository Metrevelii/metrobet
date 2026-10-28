import { z } from 'zod';

/**
 * Metro Jet: Metrobet Originals crash game. One shared round for everyone: betting window →
 * the jet climbs (multiplier grows exponentially) → it flies away at a provably fair point.
 * Players cash out before that to win bet × multiplier. RTP 97 % for any cash-out target.
 */
export const JET_BETTING_MS = 6_000;
/** Pause after a crash before the next betting window. */
export const JET_PAUSE_MS = 3_000;
/** Multiplier growth per millisecond: 2× after ≈ 8.7 s, 10× after ≈ 28.8 s. */
export const JET_GROWTH_PER_MS = 0.00008;
export const JET_MAX_MULTIPLIER = 1000;
/** Each player has two independent bet panels per round. */
export const JET_BET_SLOTS = [0, 1] as const;
export const JET_MIN_BET = 10;
export const JET_MAX_BET = 100_00;

/** Multiplier shown `elapsedMs` after take-off, floored to 2 decimals (server and client agree). */
export const jetMultiplierAt = (elapsedMs: number) =>
  Math.floor(100 * Math.exp(JET_GROWTH_PER_MS * Math.max(0, elapsedMs))) / 100;

/** Milliseconds after take-off when the multiplier reaches `multiplier`. */
export const jetElapsedFor = (multiplier: number) => Math.log(multiplier) / JET_GROWTH_PER_MS;

/**
 * Crash point from a uniform `r` in [0, 1): P(crash ≥ x) = 0.97 / x, so any cash-out target
 * returns 97 %. r < 0.03 crashes at 1.00 (no one wins).
 */
export const jetCrashPoint = (r: number) =>
  Math.min(JET_MAX_MULTIPLIER, Math.max(1, Math.floor(97 / (1 - r)) / 100));

export const JET_PHASES = ['betting', 'flying', 'crashed'] as const;
export type JetPhase = (typeof JET_PHASES)[number];

const slotSchema = z.union([z.literal(0), z.literal(1)]);
const multiplierSchema = z.number().min(1.01).max(JET_MAX_MULTIPLIER);

export const jetBetRequestSchema = z.object({
  slot: slotSchema,
  amount: z.number().int().min(JET_MIN_BET).max(JET_MAX_BET),
  /** Cash out automatically at this multiplier (optional). */
  autoCashout: multiplierSchema.nullable().default(null),
});
export type JetBetRequest = z.input<typeof jetBetRequestSchema>;
export const jetSlotRequestSchema = z.object({ slot: slotSchema });

export const jetRoundSchema = z.object({
  number: z.number().int().positive(),
  phase: z.enum(JET_PHASES),
  /** SHA-256 of the round's server seed, published before betting closes. */
  seedHash: z.string(),
  bettingEndsAt: z.number(),
  startedAt: z.number().nullable(),
  /** Revealed when the jet flies away. */
  crashPoint: z.number().nullable(),
  seed: z.string().nullable(),
});
export type JetRound = z.infer<typeof jetRoundSchema>;

/** A bet as everyone sees it (`tag` is an anonymous player label). */
export const jetPublicBetSchema = z.object({
  tag: z.string(),
  slot: slotSchema,
  amount: z.number().int(),
  cashedAt: z.number().nullable(),
  win: z.number().int(),
});
export type JetPublicBet = z.infer<typeof jetPublicBetSchema>;

export const JET_BET_STATUSES = ['placed', 'cashed', 'lost'] as const;
export const jetMyBetSchema = z.object({
  slot: slotSchema,
  amount: z.number().int(),
  autoCashout: z.number().nullable(),
  status: z.enum(JET_BET_STATUSES),
  cashedAt: z.number().nullable(),
  win: z.number().int(),
});
export type JetMyBet = z.infer<typeof jetMyBetSchema>;

export const jetHistoryItemSchema = z.object({
  number: z.number().int(),
  crashPoint: z.number(),
  seed: z.string(),
});
export type JetHistoryItem = z.infer<typeof jetHistoryItemSchema>;

/** Full state for one viewer: sent on join and after every phase change. */
export const jetStateSchema = z.object({
  /** Server clock (ms), to offset the client's clock for the multiplier animation. */
  serverTime: z.number(),
  round: jetRoundSchema,
  history: z.array(jetHistoryItemSchema),
  bets: z.array(jetPublicBetSchema),
  mine: z.array(jetMyBetSchema),
});
export type JetState = z.infer<typeof jetStateSchema>;

/** Cash-out result: the multiplier the server locked in and the amount paid. */
export const jetCashoutResultSchema = z.object({
  multiplier: z.number(),
  win: z.number().int(),
});
