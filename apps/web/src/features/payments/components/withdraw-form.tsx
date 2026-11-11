'use client';

import { type SavedCard, toMajor } from '@metrobet/contracts';
import { Alert, Button, Card, cn, Field, toast } from '@metrobet/ui';
import { CreditCard } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { requestWithdrawal } from '../actions';
import { AmountInput, parseAmount } from './amount-input';
import { usePaymentError } from './use-payment-error';

const PRESETS = [20, 50, 100, 200];

/** Card (one the player deposited with) + amount. The money is reserved until staff decide. */
export function WithdrawForm({ cards, balance }: { cards: SavedCard[]; balance: number }) {
  const t = useTranslations('Payments');
  const format = useFormatter();
  const router = useRouter();
  const errors = usePaymentError();
  const [cardId, setCardId] = useState(cards[0]!.id);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<{ form?: string; amount?: string }>({});
  const [pending, startTransition] = useTransition();
  const minor = parseAmount(amount);
  const money = (value: number) =>
    format.number(toMajor(value), { style: 'currency', currency: 'GEL' });

  const submit = () =>
    startTransition(async () => {
      const result = await requestWithdrawal({ cardId, amount: minor });
      if (!result.ok) {
        setError(
          result.fieldErrors
            ? { amount: errors.field(result.fieldErrors.amount) }
            : { form: errors.message(result) },
        );
        return;
      }
      toast.success(t('withdrawalRequested', { amount: money(minor!) }));
      router.push('/wallet');
      router.refresh();
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
        {error.form && <Alert variant="destructive">{error.form}</Alert>}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t('toCard')}</legend>
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              aria-pressed={cardId === card.id}
              onClick={() => setCardId(card.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors',
                cardId === card.id ? 'border-primary bg-primary/10' : 'hover:bg-accent',
              )}
            >
              <CreditCard className="size-5 text-muted-foreground" />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold tabular">
                  {card.brand} {card.mask}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`providers.${card.provider}`)} · {card.expiry}
                </span>
              </span>
            </button>
          ))}
        </fieldset>
        <Field
          label={t('amount')}
          error={error.amount}
          hint={t('available', { balance: money(balance) })}
        >
          <AmountInput value={amount} onChange={setAmount} presets={PRESETS} />
        </Field>
        <Button type="submit" size="lg" disabled={pending || minor === null}>
          {t('requestWithdrawal')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('withdrawalNote')}</p>
      </form>
    </Card>
  );
}
