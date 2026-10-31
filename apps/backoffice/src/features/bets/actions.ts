'use server';

import {
  type ActionResult,
  type AdminTicket,
  adminTicketSchema,
  selectionSettleInputSchema,
  toFieldErrors,
  ticketVoidInputSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

const invalid = (issues: z.core.$ZodIssue[]): ActionResult<AdminTicket> => ({
  ok: false,
  error: 'Please fix the highlighted fields.',
  fieldErrors: toFieldErrors(issues),
});

/** Voids an open ticket (stake refunded). Risk role; audit-logged by the API. */
export async function voidTicket(id: unknown, input: unknown): Promise<ActionResult<AdminTicket>> {
  const ticketId = z.uuid().safeParse(id);
  const parsed = ticketVoidInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!ticketId.success) return invalid(ticketId.error.issues);
  return runAction(['/bets', `/bets/${ticketId.data}`], () =>
    adminFetch(`bets/${ticketId.data}/void`, adminTicketSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}

/** Settles one unresolved selection by hand. Risk role; audit-logged by the API. */
export async function settleSelection(
  id: unknown,
  selectionId: unknown,
  input: unknown,
): Promise<ActionResult<AdminTicket>> {
  const ticketId = z.uuid().safeParse(id);
  const selection = z.string().min(1).max(200).safeParse(selectionId);
  const parsed = selectionSettleInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!ticketId.success || !selection.success) {
    return { ok: false, error: 'Unknown ticket or selection.', fieldErrors: {} };
  }
  return runAction(['/bets', `/bets/${ticketId.data}`], () =>
    adminFetch(
      `bets/${ticketId.data}/selections/${encodeURIComponent(selection.data)}/settle`,
      adminTicketSchema,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    ),
  );
}
