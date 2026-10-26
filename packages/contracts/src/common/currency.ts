import { z } from 'zod';

export const CURRENCIES = ['GEL'] as const;
export const DEFAULT_CURRENCY = 'GEL' satisfies Currency;

export const currencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof currencySchema>;
