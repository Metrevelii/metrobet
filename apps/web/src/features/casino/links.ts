import type { CasinoCategory } from '@metrobet/contracts';

/** The casino catalogue is shown to players as "Slots" (slot games only). */
export const SLOTS_HREF = '/slots';
export const gameHref = (slug: string) => `/slots/play/${slug}`;
export const categoryHref = (category: CasinoCategory) => `/slots/${category}`;
export const providerHref = (slug: string) => `/slots/providers/${slug}`;
