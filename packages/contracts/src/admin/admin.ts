import { z } from 'zod';

import { kycStatusSchema, playerStatusSchema } from '../auth/auth.js';
import { selectionResultSchema, ticketSchema, ticketStatusSchema } from '../sportsbook/bets.js';
import { minorAmountSchema } from '../common/money.js';
import {
  competitionSchema,
  eventDetailSchema,
  eventStatusSchema,
  liveStateSchema,
  sportSchema,
} from '../sportsbook/sportsbook.js';
import { walletTransactionsPageSchema } from '../wallet/wallet.js';

/**
 * Backoffice (staff) API shapes: players, their money and bets, sports tickets, the audit log and
 * the dashboard. Amounts are minor units. Every staff mutation takes a `reason` (audit log).
 */
export const ADMIN_PAGE_SIZE = 25;

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(ADMIN_PAGE_SIZE);
const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

/** Why a staff member did something: required on every mutation, stored in the audit log. */
export const reasonSchema = z.string().trim().min(3, 'Give a reason (3+ characters)').max(500);

// ── Players ──────────────────────────────────────────────────────────────────────────────────

export const adminPlayersQuerySchema = z.object({
  /** Email, phone (digits) or player id fragment. */
  search: z.string().trim().max(100).optional(),
  status: playerStatusSchema.optional(),
  page,
  pageSize,
});
export type AdminPlayersQuery = z.input<typeof adminPlayersQuerySchema>;

export const adminPlayerSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: playerStatusSchema,
  kycStatus: kycStatusSchema,
  verified: z.boolean(),
  dateOfBirth: z.string(),
  locale: z.string(),
  balance: z.number().int(),
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  /** End of a time-out or self-exclusion; null when permanent or not excluded. */
  excludedUntil: z.iso.datetime().nullable(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;
export const adminPlayersPageSchema = pageOf(adminPlayerSchema);
export type AdminPlayersPage = z.infer<typeof adminPlayersPageSchema>;

/** Suspend, self-exclude or reactivate a player. Anything but `active` signs them out everywhere. */
export const playerStatusUpdateSchema = z.object({
  status: playerStatusSchema,
  reason: reasonSchema,
});
export type PlayerStatusUpdate = z.infer<typeof playerStatusUpdateSchema>;

/** A player's wallet history as staff see it (same rows as the player's own `/wallet`). */
export const adminTransactionsPageSchema = walletTransactionsPageSchema;
export const adminListQuerySchema = z.object({ page, pageSize });
export type AdminListQuery = z.input<typeof adminListQuerySchema>;

// ── Casino rounds ────────────────────────────────────────────────────────────────────────────

export const gameRoundStatusSchema = z.enum(['open', 'closed']);
export const adminGameRoundSchema = z.object({
  id: z.uuid(),
  gameSlug: z.string(),
  /** The provider's round id. */
  externalId: z.string(),
  status: gameRoundStatusSchema,
  betTotal: z.number().int(),
  winTotal: z.number().int(),
  openedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type AdminGameRound = z.infer<typeof adminGameRoundSchema>;
export const adminGameRoundsPageSchema = pageOf(adminGameRoundSchema);
export type AdminGameRoundsPage = z.infer<typeof adminGameRoundsPageSchema>;

// ── Sports tickets ───────────────────────────────────────────────────────────────────────────

export const adminTicketsQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  sport: sportSchema.optional(),
  playerId: z.uuid().optional(),
  page,
  pageSize,
});
export type AdminTicketsQuery = z.input<typeof adminTicketsQuerySchema>;

export const adminTicketSchema = ticketSchema.extend({
  player: z.object({ id: z.uuid(), email: z.string().nullable(), phone: z.string().nullable() }),
});
export type AdminTicket = z.infer<typeof adminTicketSchema>;
export const adminTicketsPageSchema = pageOf(adminTicketSchema);
export type AdminTicketsPage = z.infer<typeof adminTicketsPageSchema>;

/** Void an open ticket: the stake goes back to the player. */
export const ticketVoidInputSchema = z.object({ reason: reasonSchema });
export type TicketVoidInput = z.infer<typeof ticketVoidInputSchema>;

/** Settle one unresolved selection by hand (wrong or missing feed result). */
export const selectionSettleInputSchema = z.object({
  result: selectionResultSchema,
  reason: reasonSchema,
});
export type SelectionSettleInput = z.infer<typeof selectionSettleInputSchema>;

// ── Sportsbook trading ───────────────────────────────────────────────────────────────────────

/**
 * Trading controls over the odds feed: suspensions (a whole event or one market) and rules
 * (margin, stake and win limits) per sport or competition. A competition rule wins over its
 * sport's; anything not set falls back to the feed's price and `BET_LIMITS`.
 */
export const SUSPENSION_SCOPES = ['event', 'market'] as const;
export const suspensionScopeSchema = z.enum(SUSPENSION_SCOPES);
export type SuspensionScope = z.infer<typeof suspensionScopeSchema>;

export const suspensionSchema = z.object({
  scope: suspensionScopeSchema,
  /** Event id or market id. */
  targetId: z.string(),
  eventId: z.string(),
  reason: z.string(),
  /** Staff member's name (or the audit actor when unknown). */
  by: z.string(),
  at: z.iso.datetime(),
});
export type Suspension = z.infer<typeof suspensionSchema>;

/** Suspend or resume an event or a market. */
export const suspensionInputSchema = z.object({
  scope: suspensionScopeSchema,
  targetId: z.string().min(1).max(200),
  reason: reasonSchema,
});
export type SuspensionInput = z.infer<typeof suspensionInputSchema>;

export const TRADING_RULE_SCOPES = ['sport', 'competition'] as const;
export const tradingRuleScopeSchema = z.enum(TRADING_RULE_SCOPES);
export type TradingRuleScope = z.infer<typeof tradingRuleScopeSchema>;

/** Margin in percent (implied probabilities sum to 1 + margin / 100). */
export const marginSchema = z.number().min(0).max(25).multipleOf(0.1);

const tradingRuleFields = {
  scope: tradingRuleScopeSchema,
  /** Sport (`football`) or competition id. */
  key: z.string().min(1).max(200),
  margin: marginSchema.nullable(),
  maxStake: minorAmountSchema.nullable(),
  maxPayout: minorAmountSchema.nullable(),
};

/** Set (create or replace) a rule; `null` fields inherit. */
export const tradingRuleInputSchema = z
  .object(tradingRuleFields)
  .refine((rule) => rule.margin !== null || rule.maxStake !== null || rule.maxPayout !== null, {
    message: 'Set a margin or a limit',
    path: ['margin'],
  });
export type TradingRuleInput = z.infer<typeof tradingRuleInputSchema>;

export const tradingRuleSchema = z.object({
  ...tradingRuleFields,
  /** Sport or competition name, for display. */
  label: z.string(),
  updatedAt: z.iso.datetime(),
});
export type TradingRule = z.infer<typeof tradingRuleSchema>;

/** Margin and limits that apply to an event after the rules. `margin` null = the feed's price. */
export const effectiveTradingSchema = z.object({
  margin: z.number().nullable(),
  maxStake: z.number().int(),
  maxPayout: z.number().int(),
});
export type EffectiveTrading = z.infer<typeof effectiveTradingSchema>;

export const adminTradingEventsQuerySchema = z.object({
  sport: sportSchema.optional(),
  status: z.enum(['live', 'scheduled', 'suspended']).optional(),
  /** Team or competition name fragment. */
  q: z.string().trim().max(100).optional(),
  page,
  pageSize,
});
export type AdminTradingEventsQuery = z.input<typeof adminTradingEventsQuerySchema>;

export const adminTradingEventSchema = z.object({
  id: z.string(),
  sport: sportSchema,
  competition: competitionSchema,
  home: z.string(),
  away: z.string(),
  startsAt: z.iso.datetime(),
  status: eventStatusSchema,
  live: liveStateSchema.nullable(),
  suspended: z.boolean(),
  marketCount: z.number().int(),
  suspendedMarkets: z.number().int(),
  trading: effectiveTradingSchema,
});
export type AdminTradingEvent = z.infer<typeof adminTradingEventSchema>;
export const adminTradingEventsPageSchema = pageOf(adminTradingEventSchema);
export type AdminTradingEventsPage = z.infer<typeof adminTradingEventsPageSchema>;

/**
 * One event for trading: what players see (`event`, after rules), the feed's own odds by
 * selection id, the active suspensions and the effective margin/limits.
 */
export const adminTradingEventDetailSchema = z.object({
  event: eventDetailSchema,
  feedOdds: z.record(z.string(), z.number()),
  suspensions: z.array(suspensionSchema),
  trading: effectiveTradingSchema,
});
export type AdminTradingEventDetail = z.infer<typeof adminTradingEventDetailSchema>;

export const tradingTargetsSchema = z.object({
  competitions: z.array(competitionSchema),
});
export type TradingTargets = z.infer<typeof tradingTargetsSchema>;

// ── Liability ────────────────────────────────────────────────────────────────────────────────

/**
 * What open tickets risk on an event. Singles count exactly; an accumulator counts its full
 * potential win on each of its selections (worst case: every other leg wins too).
 */
export const selectionLiabilitySchema = z.object({
  selectionId: z.string(),
  singles: z.object({ count: z.number().int(), stake: z.number().int(), payout: z.number().int() }),
  combos: z.object({ count: z.number().int(), payout: z.number().int() }),
  /** Market's single stakes − payouts if this selection wins (negative = loss). */
  net: z.number().int(),
});
export type SelectionLiability = z.infer<typeof selectionLiabilitySchema>;

export const marketLiabilitySchema = z.object({
  marketId: z.string(),
  /** Stakes of singles on this market (what we keep from the losing selections). */
  stake: z.number().int(),
  selections: z.array(selectionLiabilitySchema),
});
export type MarketLiability = z.infer<typeof marketLiabilitySchema>;

export const eventLiabilitySummarySchema = z.object({
  eventId: z.string(),
  /** Open tickets with a selection on the event. */
  tickets: z.number().int(),
  /** Their stakes. */
  stake: z.number().int(),
  /** Sum over markets of the worst loss (an upper bound of what the event can cost). */
  worstCase: z.number().int(),
});
export type EventLiabilitySummary = z.infer<typeof eventLiabilitySummarySchema>;

export const eventLiabilitySchema = eventLiabilitySummarySchema.extend({
  markets: z.array(marketLiabilitySchema),
});
export type EventLiability = z.infer<typeof eventLiabilitySchema>;

export const liabilityQuerySchema = z.object({
  /** Comma-separated event ids (at most 100). */
  eventIds: z
    .string()
    .max(10_000)
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.string().min(1)).max(100)),
});

// ── Audit log ────────────────────────────────────────────────────────────────────────────────

export const auditQuerySchema = z.object({
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(100).optional(),
  page,
  pageSize,
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export const auditEntrySchema = z.object({
  id: z.uuid(),
  /** e.g. `staff:<id>`; `actorName` is the staff member's name when known. */
  actor: z.string(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  createdAt: z.iso.datetime(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export const auditPageSchema = pageOf(auditEntrySchema);
export type AuditPage = z.infer<typeof auditPageSchema>;

// ── Dashboard ────────────────────────────────────────────────────────────────────────────────

/** Stakes, wins and refunds of one product over the period; GGR = stakes − wins − refunds. */
export const productTotalsSchema = z.object({
  stakes: z.number().int(),
  wins: z.number().int(),
  refunds: z.number().int(),
  ggr: z.number().int(),
  bets: z.number().int(),
});
export type ProductTotals = z.infer<typeof productTotalsSchema>;

export const dashboardSchema = z.object({
  /** Start of the day in Asia/Tbilisi the numbers cover. */
  since: z.iso.datetime(),
  casino: productTotalsSchema,
  sportsbook: productTotalsSchema,
  deposits: z.number().int(),
  /** Bonus money that became cash today (completed wagering): what bonuses cost. */
  bonusCost: z.number().int(),
  newPlayers: z.number().int(),
  /** Players with at least one bet today. */
  activePlayers: z.number().int(),
  openTickets: z.number().int(),
  /** What the platform owes players right now (sum of player balances). */
  playerBalances: z.number().int(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
