'use server';

import {
  type ActionResult,
  type Suspension,
  suspensionInputSchema,
  suspensionSchema,
  toFieldErrors,
  type TradingRule,
  tradingRuleInputSchema,
  tradingRuleSchema,
  tradingRuleScopeSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

const invalid = <T>(issues: z.core.$ZodIssue[]): ActionResult<T> => ({
  ok: false,
  error: 'Please fix the highlighted fields.',
  fieldErrors: toFieldErrors(issues),
});

/** Suspends an event or a market for players at once. Risk role; audit-logged by the API. */
export async function suspend(input: unknown): Promise<ActionResult<Suspension>> {
  const parsed = suspensionInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return runAction(['/sportsbook'], () =>
    adminFetch('sportsbook/suspensions', suspensionSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}

/** Lifts a suspension. Risk role; audit-logged by the API. */
export async function resume(input: unknown): Promise<ActionResult<null>> {
  const parsed = suspensionInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return runAction(['/sportsbook'], async () => {
    await adminFetch('sportsbook/suspensions/resume', z.undefined(), {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    return null;
  });
}

/** Creates or replaces a margin / limits rule for a sport or competition. */
export async function saveRule(input: unknown): Promise<ActionResult<TradingRule>> {
  const parsed = tradingRuleInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return runAction(['/sportsbook/rules'], () =>
    adminFetch('sportsbook/rules', tradingRuleSchema, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    }),
  );
}

export async function deleteRule(scope: unknown, key: unknown): Promise<ActionResult<null>> {
  const parsedScope = tradingRuleScopeSchema.safeParse(scope);
  const parsedKey = z.string().min(1).max(200).safeParse(key);
  if (!parsedScope.success || !parsedKey.success) {
    return { ok: false, error: 'Unknown rule.', fieldErrors: {} };
  }
  return runAction(['/sportsbook/rules'], async () => {
    await adminFetch(
      `sportsbook/rules/${parsedScope.data}/${encodeURIComponent(parsedKey.data)}`,
      z.undefined(),
      { method: 'DELETE' },
    );
    return null;
  });
}
