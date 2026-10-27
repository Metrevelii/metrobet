import type { CasinoCategory } from '@metrobet/contracts';

/** The casino catalogue is shown to players as "Slots" (slot games only). */
export const SLOTS_HREF = '/slots';

/**
 * A Slots listing: the "All" tab or a provider tab, optionally filtered by category.
 * `popular` is the default order, so it has no query parameter.
 */
export function slotsHref({
  provider,
  category,
}: { provider?: string; category?: CasinoCategory } = {}) {
  const base = provider ? `${SLOTS_HREF}/providers/${provider}` : SLOTS_HREF;
  return category && category !== 'popular' ? `${base}?category=${category}` : base;
}

export const gameHref = (slug: string) => `${SLOTS_HREF}/play/${slug}`;
export const categoryHref = (category: CasinoCategory) => slotsHref({ category });
export const providerHref = (provider: string) => slotsHref({ provider });
