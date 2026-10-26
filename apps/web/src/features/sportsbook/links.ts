import type { Sport } from '@metrobet/contracts';

export const sportHref = (sport: Sport) => `/sports/${sport}`;
export const eventHref = (sport: Sport, eventId: string) => `/sports/${sport}/${eventId}`;
