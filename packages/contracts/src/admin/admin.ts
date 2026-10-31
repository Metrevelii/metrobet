import { z } from 'zod';

import { kycStatusSchema, playerStatusSchema } from '../auth/auth.js';
import { selectionResultSchema, ticketSchema, ticketStatusSchema } from '../sportsbook/bets.js';
import { sportSchema } from '../sportsbook/sportsbook.js';
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
  newPlayers: z.number().int(),
  /** Players with at least one bet today. */
  activePlayers: z.number().int(),
  openTickets: z.number().int(),
  /** What the platform owes players right now (sum of player balances). */
  playerBalances: z.number().int(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
