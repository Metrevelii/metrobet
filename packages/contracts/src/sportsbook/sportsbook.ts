import { z } from 'zod';

/** `esoccer`: short simulated-football matches (2 × 4 min) played all day. */
export const SPORTS = ['football', 'basketball', 'tennis', 'esoccer'] as const;
export const sportSchema = z.enum(SPORTS);
export type Sport = z.infer<typeof sportSchema>;

/**
 * Market types. Labels are localized on the client from `type` (+ `line`), so the API never
 * sends display text for markets or selections.
 * - 1x2, double_chance, btts: football
 * - moneyline: winner (basketball, tennis)
 * - total: over/under `line` (goals, points)
 * - spread: handicap `line` applied to home
 * - set_winner: winner of set number `line` (tennis)
 * - ht_1x2: result of the first half (football, eSoccer)
 * - correct_score: exact final score, `cs_<home>_<away>` up to 3–3, else `cs_other`
 * - team_total_home / team_total_away: one team's goals over/under `line`
 */
export const MARKET_TYPES = [
  '1x2',
  'double_chance',
  'total',
  'btts',
  'moneyline',
  'spread',
  'set_winner',
  'ht_1x2',
  'correct_score',
  'team_total_home',
  'team_total_away',
] as const;
export const marketTypeSchema = z.enum(MARKET_TYPES);
export type MarketType = z.infer<typeof marketTypeSchema>;

/** Correct-score grid: 0–0 … 3–3. Anything outside it is `cs_other`. */
export const CORRECT_SCORE_MAX = 3;
const CORRECT_SCORES = [0, 1, 2, 3].flatMap((home) =>
  [0, 1, 2, 3].map((away) => `cs_${home}_${away}` as const),
);

export const SELECTION_KEYS = [
  'home',
  'draw',
  'away',
  'over',
  'under',
  'yes',
  'no',
  'home_draw',
  'home_away',
  'draw_away',
  ...CORRECT_SCORES,
  'cs_other',
] as const;
export const selectionKeySchema = z.enum(SELECTION_KEYS);
export type SelectionKey = z.infer<typeof selectionKeySchema>;

export const selectionSchema = z.object({
  /** Globally unique: `${marketId}:${key}`. */
  id: z.string(),
  key: selectionKeySchema,
  /** Decimal odds, 2 decimals. */
  odds: z.number(),
  active: z.boolean(),
});
export type Selection = z.infer<typeof selectionSchema>;

/** open: bettable · suspended: temporary bet stop (e.g. after a goal) · closed: outcome decided. */
export const MARKET_STATUSES = ['open', 'suspended', 'closed'] as const;
export const marketStatusSchema = z.enum(MARKET_STATUSES);
export type MarketStatus = z.infer<typeof marketStatusSchema>;

export const marketSchema = z.object({
  /** Globally unique: `${eventId}:${type}:${line ?? '-'}`. */
  id: z.string(),
  type: marketTypeSchema,
  line: z.number().nullable(),
  status: marketStatusSchema,
  selections: z.array(selectionSchema),
});
export type Market = z.infer<typeof marketSchema>;

export const competitorSchema = z.object({ name: z.string(), abbreviation: z.string() });
export type Competitor = z.infer<typeof competitorSchema>;

export const competitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  sport: sportSchema,
});
export type Competition = z.infer<typeof competitionSchema>;

export const EVENT_STATUSES = ['scheduled', 'live', 'ended'] as const;
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const scoreSchema = z.object({ home: z.number().int(), away: z.number().int() });
export type Score = z.infer<typeof scoreSchema>;

/**
 * In-play state. `period`: 1H, HT, 2H (football) · Q1–Q4, BREAK (basketball) · S1–S3 (tennis) ·
 * FT when finished. `clock`: match minute (football, "67'") or time left in the quarter
 * (basketball, "04:12"); null for tennis. `score` is goals/points/sets.
 */
export const liveStateSchema = z.object({
  period: z.string(),
  clock: z.string().nullable(),
  score: scoreSchema,
  periodScores: z.array(scoreSchema),
});
export type LiveState = z.infer<typeof liveStateSchema>;

const eventBaseSchema = z.object({
  id: z.string(),
  sport: sportSchema,
  competition: competitionSchema,
  home: competitorSchema,
  away: competitorSchema,
  startsAt: z.iso.datetime(),
  status: eventStatusSchema,
  live: liveStateSchema.nullable(),
});

/**
 * List row: the event, its headline market (1x2 / moneyline) and the markets shown as columns
 * of the match table (`TABLE_COLUMNS`, one main line per market type).
 */
export const eventSummarySchema = eventBaseSchema.extend({
  mainMarket: marketSchema.nullable(),
  markets: z.array(marketSchema),
  marketCount: z.number().int(),
});
export type EventSummary = z.infer<typeof eventSummarySchema>;

export const eventDetailSchema = eventBaseSchema.extend({ markets: z.array(marketSchema) });
export type EventDetail = z.infer<typeof eventDetailSchema>;

/**
 * Match table columns per sport: groups of selections of one market type. `line: true` adds a
 * cell with the market's line (total 2.5, handicap −4.5, set 2) before the prices. The first
 * group is always shown; the others on wider screens.
 */
export type TableColumnGroup = { type: MarketType; keys: SelectionKey[]; line?: boolean };
export const TABLE_COLUMNS: Record<Sport, TableColumnGroup[]> = {
  football: [
    { type: '1x2', keys: ['home', 'draw', 'away'] },
    { type: 'double_chance', keys: ['home_draw', 'home_away', 'draw_away'] },
    { type: 'total', keys: ['over', 'under'], line: true },
  ],
  basketball: [
    { type: 'moneyline', keys: ['home', 'away'] },
    { type: 'spread', keys: ['home', 'away'], line: true },
    { type: 'total', keys: ['over', 'under'], line: true },
  ],
  tennis: [
    { type: 'moneyline', keys: ['home', 'away'] },
    { type: 'set_winner', keys: ['home', 'away'], line: true },
  ],
  esoccer: [
    { type: '1x2', keys: ['home', 'draw', 'away'] },
    { type: 'double_chance', keys: ['home_draw', 'home_away', 'draw_away'] },
    { type: 'total', keys: ['over', 'under'], line: true },
  ],
};

/** The score of a correct-score key (`cs_2_1` → 2–1), or null for `cs_other` / other keys. */
export function correctScoreOf(key: string): { home: number; away: number } | null {
  const match = /^cs_(\d+)_(\d+)$/.exec(key);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

/** Listing filters (days are Tbilisi calendar days; `soon` = starting within an hour). */
export const DAY_FILTERS = ['all', 'today', 'tomorrow', 'soon'] as const;
export const dayFilterSchema = z.enum(DAY_FILTERS);
export type DayFilter = z.infer<typeof dayFilterSchema>;

export const sportOverviewQuerySchema = z.object({
  day: dayFilterSchema.catch('all').default('all'),
  /** Comma-separated competition ids (e.g. the player's favourites); all when empty. */
  competitions: z
    .string()
    .max(500)
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean).slice(0, 30) : [])),
});
export type SportOverviewQuery = z.input<typeof sportOverviewQuerySchema>;

/** A competition with its event counts, for the league navigation. */
export const competitionSummarySchema = z.object({
  competition: competitionSchema,
  liveCount: z.number().int(),
  upcomingCount: z.number().int(),
});
export type CompetitionSummary = z.infer<typeof competitionSummarySchema>;

export const competitionEventsSchema = z.object({
  competition: competitionSchema,
  events: z.array(eventSummarySchema),
});
export type CompetitionEvents = z.infer<typeof competitionEventsSchema>;

export const sportSummarySchema = z.object({
  sport: sportSchema,
  liveCount: z.number().int(),
  upcomingCount: z.number().int(),
});
export type SportSummary = z.infer<typeof sportSummarySchema>;

export const sportOverviewSchema = z.object({
  live: z.array(competitionEventsSchema),
  upcoming: z.array(competitionEventsSchema),
});
export type SportOverview = z.infer<typeof sportOverviewSchema>;

// ── Real-time (Socket.IO) ──────────────────────────────────────────────────────────────────

export const SPORTSBOOK_WS_NAMESPACE = '/sportsbook';

/** Client → server and server → client message names. */
export const SPORTSBOOK_WS = {
  /** client: `{ eventIds }`, ack: `EventUpdate[]` (current state of each event). */
  subscribe: 'subscribe',
  /** client: `{ eventIds }`. */
  unsubscribe: 'unsubscribe',
  /** server: `EventUpdate` for a subscribed event. */
  update: 'update',
  /** server (to everyone): the set of live events changed; lists may refetch. */
  liveChanged: 'live-changed',
} as const;

export const subscriptionSchema = z.object({ eventIds: z.array(z.string()).max(200) });
export type Subscription = z.infer<typeof subscriptionSchema>;

/** State change of one event. `markets` holds only markets that changed. */
export const eventUpdateSchema = z.object({
  eventId: z.string(),
  status: eventStatusSchema,
  live: liveStateSchema.nullable(),
  markets: z.array(marketSchema),
});
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
