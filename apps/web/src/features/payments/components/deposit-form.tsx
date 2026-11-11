'use client';

import { PAYMENT_PROVIDERS, type PaymentProvider } from '@metrobet/contracts';
import { Alert, Button, Card, cn, Field } from '@metrobet/ui';
import { Landmark, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';
import { LIMITS_HREF } from '@/features/account/use-limit-message';

import { startDeposit } from '../actions';
import { AmountInput, parseAmount } from './amount-input';
import { usePaymentError } from './use-payment-error';

const PRESETS = [10, 20, 50, 100, 200];

/** Bank + amount, then off to the bank's card page. Card details never touch Metrobet. */
export function DepositForm() {
  const t = useTranslations('Payments');
  const errors = usePaymentError();
  const [provider, setProvider] = useState<PaymentProvider>('tbc');
  const [amount, setAmount] = useState('20');
  const [error, setError] = useState<{
    form?: string;
    amount?: string;
    link?: 'limits' | 'identity';
  }>({});
  const [pending, startTransition] = useTransition();
  const minor = parseAmount(amount);

  const submit = () =>
    startTransition(async () => {
      const result = await startDeposit({ provider, amount: minor });
      if (result.ok) {
        // Leaving for the bank; keep the button disabled until the page changes.
        window.location.assign(result.data);
        await new Promise(() => undefined);
        return;
      }
      setError(
        result.fieldErrors
          ? { amount: errors.field(result.fieldErrors.amount) }
          : {
              form: errors.message(result),
              link:
                result.error === 'LIMIT_EXCEEDED'
                  ? 'limits'
                  : result.error === 'KYC_REQUIRED'
                    ? 'identity'
                    : undefined,
            },
      );
    });

  return (
    <Card className="flex flex-col gap-5 p-5">
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (minor) submit();
        }}
      >
        {error.form && (
          <Alert variant="destructive">
            {error.form}{' '}
            {error.link && (
              <Link
                href={error.link === 'limits' ? LIMITS_HREF : '/account/identity'}
                className="font-semibold underline"
              >
                {t(error.link === 'limits' ? 'manageLimits' : 'verifyIdentity')}
              </Link>
            )}
          </Alert>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t('bank')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_PROVIDERS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={provider === item}
                onClick={() => setProvider(item)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors',
                  provider === item ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <Landmark className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{t(`providers.${item}`)}</span>
                  <span className="text-xs text-muted-foreground">{t('cards')}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t('amount')} error={error.amount} hint={t('depositRange')}>
          <AmountInput value={amount} onChange={setAmount} presets={PRESETS} />
        </Field>
        <Button type="submit" size="lg" disabled={pending || minor === null}>
          {pending ? t('redirecting') : t('continueToBank')}
        </Button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          {t('secureNote')}
        </p>
      </form>
    </Card>
  );
}
