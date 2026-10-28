import { Button } from '@metrobet/ui';
import { WalletIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { getWallet } from '../data';
import { LiveBalance } from '../live-balance';

/** Header balance chip linking to the wallet. Nothing when signed out. Render in <Suspense>. */
export async function HeaderBalance() {
  const wallet = await getWallet();
  if (!wallet) return null;
  const t = await getTranslations('Wallet');
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link href="/wallet" aria-label={t('title')} className="gap-2 tabular-nums">
        <WalletIcon className="text-primary" />
        <LiveBalance key={wallet.balance} balance={wallet.balance} currency={wallet.currency} />
      </Link>
    </Button>
  );
}
