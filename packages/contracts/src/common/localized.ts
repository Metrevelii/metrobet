import { z } from 'zod';

import { localeSchema, type Locale } from './locale.js';

/** Text stored once per supported locale (all required), e.g. CMS-managed copy. */
export const localizedTextSchema = z.record(localeSchema, z.string().trim().min(1, 'Required'));
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
