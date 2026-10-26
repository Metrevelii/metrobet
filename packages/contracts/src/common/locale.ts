import { z } from 'zod';

export const LOCALES = ['ka', 'en', 'ru'] as const;
export const DEFAULT_LOCALE = 'ka' satisfies Locale;

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
