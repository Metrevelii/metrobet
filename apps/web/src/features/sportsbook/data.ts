import {
  type CompetitionEvents,
  competitionEventsSchema,
  type EventDetail,
  eventDetailSchema,
  type Sport,
  type SportOverview,
  sportOverviewSchema,
  type SportSummary,
  sportSummarySchema,
} from '@metrobet/contracts';

import { connection } from 'next/server';

import { ApiError, apiGet } from '@/lib/api';

/*
 * Sportsbook data is live: snapshots are fetched per request (never cached) and kept fresh by
 * the Socket.IO subscription on the client. `connection()` marks each loader as request-time,
 * so prerendering stops before the fetch. Render these inside <Suspense>.
 */

export async function getSports(): Promise<SportSummary[]> {
  await connection();
  try {
    return await apiGet('sportsbook/sports', sportSummarySchema.array());
  } catch (error) {
    console.error('[sportsbook] Failed to load sports', error);
    return [];
  }
}

export async function getSportOverview(sport: Sport): Promise<SportOverview | null> {
  await connection();
  try {
    return await apiGet(`sportsbook/sports/${sport}`, sportOverviewSchema);
  } catch (error) {
    console.error(`[sportsbook] Failed to load ${sport}`, error);
    return null;
  }
}

export async function getLive(): Promise<CompetitionEvents[] | null> {
  await connection();
  try {
    return await apiGet('sportsbook/live', competitionEventsSchema.array());
  } catch (error) {
    console.error('[sportsbook] Failed to load live events', error);
    return null;
  }
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  await connection();
  try {
    return await apiGet(`sportsbook/events/${encodeURIComponent(id)}`, eventDetailSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
