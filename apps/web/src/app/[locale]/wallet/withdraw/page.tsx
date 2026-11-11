import { Button, Card, Skeleton } from '@metrobet/ui';
import { ChevronLeft, CreditCard, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { getCurrentPlayer } from '@/features/auth';
import { getSavedCards, WithdrawForm } from '@/features/payments';
import { getWallet } from '@/features/wallet';
import { Link, redirect } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Payments');
  return { title: t('withdrawTitle'), robots: { index: false } };
}

/** Needs a confirmed contact and a card the player deposited with. */
async function Withdraw() {
  const player = await getCurrentPlayer();
  if (!player) redirect({ href: '/login?next=/wallet/withdraw', locale: await getLocale() });
  const [cards, wallet, t] = await Promise.all([
    getSavedCards(),
    getWallet(),
    getTranslations('Payments'),
  ]);
  if (!player!.verified) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title={t('verifyFirst')}
          description={t('verifyFirstHint')}
          action={
            <Button asChild>
              <Link href="/verify?next=/wallet/withdraw">{t('verify')}</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  if (!cards || cards.length === 0 || !wallet) {
    return (
      <Card>
        <EmptyState
          icon={CreditCard}
          title={t('noCards')}
          description={t('noCardsHint')}
          action={
            <Button asChild>
              <Link href="/wallet/deposit">{t('depositTitle')}</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  return <WithdrawForm cards={cards} balance={wallet.balance} />;
}

export default async function WithdrawPage() {
  const t = await getTranslations('Payments');
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/wallet"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t('backToWallet')}
        </Link>
        <h1 className="text-2xl font-bold">{t('withdrawTitle')}</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Withdraw />
      </Suspense>
    </div>
  );
}
