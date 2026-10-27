import { type CasinoCategory, casinoCategorySchema } from '@metrobet/contracts';

/** `?category=` from a Slots URL; anything unknown falls back to the default (popular). */
export function categoryParam(value: string | string[] | undefined): CasinoCategory {
  return casinoCategorySchema.catch('popular').parse(Array.isArray(value) ? value[0] : value);
}
