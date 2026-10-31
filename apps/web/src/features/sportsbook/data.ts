import {
  type CompetitionEvents,
  competitionSummarySchema,
  type CompetitionSummary,
  type DayFilter,
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

export async function getSportOverview(
  sport: Sport,
  { day = 'all', competitions = [] }: { day?: DayFilter; competitions?: string[] } = {},
): Promise<SportOverview | null> {
  await connection();
  try {
    return await apiGet(`sportsbook/sports/${sport}`, sportOverviewSchema, {
      day,
      competitions: competitions.length > 0 ? competitions.join(',') : undefined,
    });
  } catch (error) {
    console.error(`[sportsbook] Failed to load ${sport}`, error);
    return null;
  }
}

/** A sport's leagues with live / upcoming counts (league navigation). Empty on failure. */
export async function getCompetitions(sport: Sport): Promise<CompetitionSummary[]> {
  await connection();
  try {
    return await apiGet(
      `sportsbook/sports/${sport}/competitions`,
      competitionSummarySchema.array(),
    );
  } catch (error) {
    console.error(`[sportsbook] Failed to load ${sport} competitions`, error);
    return [];
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
