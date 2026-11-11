import { toMajor } from '@metrobet/contracts';
import { Alert } from '@metrobet/ui';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getPayment } from '../data';

/** The outcome of the deposit the bank just sent the player back from (`/wallet?payment=`). */
export async function PaymentResult({ id }: { id: string }) {
  const [payment, format, t] = await Promise.all([
    getPayment(id),
    getFormatter(),
    getTranslations('Payments.result'),
  ]);
  if (payment?.kind !== 'deposit') return null;
  const amount = format.number(toMajor(payment.amount), { style: 'currency', currency: 'GEL' });
  if (payment.status === 'succeeded') {
    return <Alert variant="success">{t('succeeded', { amount })}</Alert>;
  }
  if (payment.status === 'pending') return <Alert>{t('pending', { amount })}</Alert>;
  return (
    <Alert variant={payment.status === 'cancelled' ? 'default' : 'destructive'}>
      {t(payment.status === 'cancelled' ? 'cancelled' : 'failed', { amount })}
      {payment.reason && payment.status === 'failed' && ` (${payment.reason})`}
    </Alert>
  );
}
