import { z } from 'zod';

/**
 * Crash games of Metrobet Originals (Metro Jet, Longshot). They share one engine and rules and
 * differ only in their picture. Per game: one shared round for everyone, betting window → the
 * multiplier grows exponentially → it crashes at a provably fair point. Players cash out before
 * that to win bet × multiplier. RTP 97 % for any cash-out target.
 */
export const CRASH_GAMES = ['metro-jet', 'longshot'] as const;
export const crashGameSchema = z.enum(CRASH_GAMES);
export type CrashGame = z.infer<typeof crashGameSchema>;

export const CRASH_BETTING_MS = 6_000;
/** Pause after a crash before the next betting window. */
export const CRASH_PAUSE_MS = 3_000;
/** Multiplier growth per millisecond: 2× after ≈ 8.7 s, 10× after ≈ 28.8 s. */
export const CRASH_GROWTH_PER_MS = 0.00008;
export const CRASH_MAX_MULTIPLIER = 1000;
/** Each player has two independent bet panels per round. */
export const CRASH_BET_SLOTS = [0, 1] as const;
export const CRASH_MIN_BET = 10;
export const CRASH_MAX_BET = 100_00;

/** Multiplier shown `elapsedMs` after take-off, floored to 2 decimals (server and client agree). */
export const crashMultiplierAt = (elapsedMs: number) =>
  Math.floor(100 * Math.exp(CRASH_GROWTH_PER_MS * Math.max(0, elapsedMs))) / 100;

/** Milliseconds after take-off when the multiplier reaches `multiplier`. */
export const crashElapsedFor = (multiplier: number) => Math.log(multiplier) / CRASH_GROWTH_PER_MS;

/**
 * Crash point from a uniform `r` in [0, 1): P(crash ≥ x) = 0.97 / x, so any cash-out target
 * returns 97 %. Everything below 1.01 shows as 1.00 (no one wins).
 */
export const crashPointFromUniform = (r: number) =>
  Math.min(CRASH_MAX_MULTIPLIER, Math.max(1, Math.floor(97 / (1 - r)) / 100));

export const CRASH_PHASES = ['betting', 'flying', 'crashed'] as const;
export type CrashPhase = (typeof CRASH_PHASES)[number];

const slotSchema = z.union([z.literal(0), z.literal(1)]);
const multiplierSchema = z.number().min(1.01).max(CRASH_MAX_MULTIPLIER);

export const crashJoinRequestSchema = z.object({ game: crashGameSchema });

export const crashBetRequestSchema = z.object({
  game: crashGameSchema,
  slot: slotSchema,
  amount: z.number().int().min(CRASH_MIN_BET).max(CRASH_MAX_BET),
  /** Cash out automatically at this multiplier (optional). */
  autoCashout: multiplierSchema.nullable().default(null),
});
export type CrashBetRequest = z.input<typeof crashBetRequestSchema>;
export const crashSlotRequestSchema = z.object({ game: crashGameSchema, slot: slotSchema });

export const crashRoundSchema = z.object({
  number: z.number().int().positive(),
  phase: z.enum(CRASH_PHASES),
  /** SHA-256 of the round's server seed, published before betting closes. */
  seedHash: z.string(),
  bettingEndsAt: z.number(),
  startedAt: z.number().nullable(),
  /** Revealed at the crash. */
  crashPoint: z.number().nullable(),
  seed: z.string().nullable(),
});
export type CrashRound = z.infer<typeof crashRoundSchema>;

/** A bet as everyone sees it (`tag` is an anonymous player label). */
export const crashPublicBetSchema = z.object({
  tag: z.string(),
  slot: slotSchema,
  amount: z.number().int(),
  cashedAt: z.number().nullable(),
  win: z.number().int(),
});
export type CrashPublicBet = z.infer<typeof crashPublicBetSchema>;

export const CRASH_BET_STATUSES = ['placed', 'cashed', 'lost'] as const;
export const crashMyBetSchema = z.object({
  slot: slotSchema,
  amount: z.number().int(),
  autoCashout: z.number().nullable(),
  status: z.enum(CRASH_BET_STATUSES),
  cashedAt: z.number().nullable(),
  win: z.number().int(),
});
export type CrashMyBet = z.infer<typeof crashMyBetSchema>;

export const crashHistoryItemSchema = z.object({
  number: z.number().int(),
  crashPoint: z.number(),
  seed: z.string(),
});
export type CrashHistoryItem = z.infer<typeof crashHistoryItemSchema>;

/** Full state of one game for one viewer: sent on join and after every phase change. */
export const crashStateSchema = z.object({
  game: crashGameSchema,
  /** Server clock (ms), to offset the client's clock for the multiplier animation. */
  serverTime: z.number(),
  round: crashRoundSchema,
  history: z.array(crashHistoryItemSchema),
  bets: z.array(crashPublicBetSchema),
  mine: z.array(crashMyBetSchema),
});
export type CrashState = z.infer<typeof crashStateSchema>;

/** Pushed when a game's public bets change (`crash:bets`). */
export const crashBetsMessageSchema = z.object({
  game: crashGameSchema,
  bets: z.array(crashPublicBetSchema),
});
/** Pushed when this viewer's bets change, e.g. an auto cash-out (`crash:mine`). */
export const crashMineMessageSchema = z.object({
  game: crashGameSchema,
  mine: z.array(crashMyBetSchema),
});

/** Cash-out result: the multiplier the server locked in and the amount paid. */
export const crashCashoutResultSchema = z.object({
  multiplier: z.number(),
  win: z.number().int(),
});
