import type { CasinoCategory } from '@metrobet/contracts';

export const gameHref = (slug: string) => `/casino/play/${slug}`;
export const categoryHref = (category: CasinoCategory) => `/casino/${category}`;
export const providerHref = (slug: string) => `/casino/providers/${slug}`;
