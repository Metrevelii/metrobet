import { Button } from '@metrobet/ui';
import { Gift, WalletIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { getWallet } from '../data';
import { LiveBalance } from '../live-balance';

/**
 * Header balance chip linking to the wallet: what the player can bet with (cash + bonus money,
 * the same total games and live pushes report), with a gift mark while bonus money is part of
 * it. Nothing when signed out. Render in <Suspense>.
 */
export async function HeaderBalance() {
  const wallet = await getWallet();
  if (!wallet) return null;
  const t = await getTranslations('Wallet');
  const playable = wallet.balance + wallet.bonusBalance;
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link
        href="/wallet"
        aria-label={wallet.bonusBalance > 0 ? t('titleWithBonus') : t('title')}
        className="gap-2 tabular-nums"
      >
        {wallet.bonusBalance > 0 ? (
          <Gift className="text-primary" />
        ) : (
          <WalletIcon className="text-primary" />
        )}
        <LiveBalance key={playable} balance={playable} currency={wallet.currency} />
      </Link>
    </Button>
  );
}
