import {
  type AdminTradingEventDetail,
  adminTradingEventDetailSchema,
  type AdminTradingEventsPage,
  adminTradingEventsPageSchema,
  type AdminTradingEventsQuery,
  type EventLiability,
  eventLiabilitySchema,
  type EventLiabilitySummary,
  eventLiabilitySummarySchema,
  type TradingRule,
  tradingRuleSchema,
  type TradingTargets,
  tradingTargetsSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session, live prices): render inside <Suspense>. */
export function listTradingEvents(query: AdminTradingEventsQuery): Promise<AdminTradingEventsPage> {
  return adminFetch(withQuery('sportsbook/events', query), adminTradingEventsPageSchema);
}

export async function getTradingEvent(id: string): Promise<AdminTradingEventDetail | null> {
  try {
    return await adminFetch(
      `sportsbook/events/${encodeURIComponent(id)}`,
      adminTradingEventDetailSchema,
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) return null;
    throw error;
  }
}

/** Liability totals per event (open tickets). */
export function liabilitySummaries(eventIds: string[]): Promise<EventLiabilitySummary[]> {
  if (eventIds.length === 0) return Promise.resolve([]);
  return adminFetch(
    withQuery('sportsbook/liability', { eventIds: eventIds.join(',') }),
    z.array(eventLiabilitySummarySchema),
  );
}

export function eventLiability(eventId: string): Promise<EventLiability> {
  return adminFetch(`sportsbook/liability/${encodeURIComponent(eventId)}`, eventLiabilitySchema);
}

export function listTradingRules(): Promise<TradingRule[]> {
  return adminFetch('sportsbook/rules', z.array(tradingRuleSchema));
}

export function tradingTargets(): Promise<TradingTargets> {
  return adminFetch('sportsbook/targets', tradingTargetsSchema);
}
