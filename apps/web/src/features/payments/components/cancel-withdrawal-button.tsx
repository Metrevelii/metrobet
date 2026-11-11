'use client';

import { Button, toast } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { cancelWithdrawal } from '../actions';
import { usePaymentError } from './use-payment-error';

export function CancelWithdrawalButton({ id }: { id: string }) {
  const t = useTranslations('Payments');
  const errors = usePaymentError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelWithdrawal(id);
          if (!result.ok) {
            toast.error(errors.message(result), { id: 'withdrawal-cancel' });
          } else {
            toast.success(t('withdrawalCancelled'));
          }
          router.refresh();
        })
      }
    >
      {t('cancel')}
    </Button>
  );
}
