import type { DayFilter, Sport } from '@metrobet/contracts';

export type SportFilters = { day?: DayFilter; competitions?: string[] };

/** A sport listing, optionally filtered (`?day=` and `?competitions=id,id`). */
export function sportHref(sport: Sport, { day, competitions }: SportFilters = {}) {
  const params = new URLSearchParams();
  if (day && day !== 'all') params.set('day', day);
  if (competitions && competitions.length > 0) params.set('competitions', competitions.join(','));
  const query = params.toString();
  return `/sports/${sport}${query ? `?${query}` : ''}`;
}

export const eventHref = (sport: Sport, eventId: string) => `/sports/${sport}/${eventId}`;
