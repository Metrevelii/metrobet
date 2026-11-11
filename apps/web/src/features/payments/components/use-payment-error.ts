'use client';

import { useTranslations } from 'next-intl';

import { useLimitMessage } from '@/features/account/use-limit-message';

import type { PaymentResult } from '../actions';

/** Translated text for a failed payment action (limit details when the API sent them). */
export function usePaymentError() {
  const t = useTranslations('Payments');
  const limitMessage = useLimitMessage();
  return {
    message: (result: Extract<PaymentResult<unknown>, { ok: false }>) =>
      result.limit
        ? limitMessage(result.limit)
        : t.has(`errors.${result.error}` as 'errors.generic')
          ? t(`errors.${result.error}` as 'errors.generic')
          : t('errors.generic'),
    field: (key: string | undefined) =>
      key === undefined
        ? undefined
        : t.has(`validation.${key}` as 'validation.depositMin')
          ? t(`validation.${key}` as 'validation.depositMin')
          : t('errors.generic'),
  };
}
