'use client';

import { type LimitExceeded, toMajor } from '@metrobet/contracts';
import { useFormatter, useTranslations } from 'next-intl';

/** Where players manage their limits (linked from "limit reached" messages). */
export const LIMITS_HREF = '/account/responsible-gaming';

/** "You have X left of your daily loss limit." for a LIMIT_EXCEEDED error. */
export function useLimitMessage() {
  const t = useTranslations('Account');
  const format = useFormatter();
  return (limit: LimitExceeded) =>
    t('limitReached', {
      kind: limit.kind,
      period: limit.period,
      remaining: format.number(toMajor(limit.remaining), { style: 'currency', currency: 'GEL' }),
    });
}
