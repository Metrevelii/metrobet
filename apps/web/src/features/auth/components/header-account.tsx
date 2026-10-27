import { Button } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { getCurrentPlayer } from '../data';
import { SessionSync } from '../session-store';
import { AccountMenu } from './account-menu';

/** Header right side: account menu when signed in, otherwise log in / sign up. Render in <Suspense>. */
export async function HeaderAccount() {
  const [player, t] = await Promise.all([getCurrentPlayer(), getTranslations('Header')]);
  return (
    <>
      <SessionSync signedIn={player !== null} />
      {player ? (
        <AccountMenu player={player} />
      ) : (
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">{t('login')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">{t('register')}</Link>
          </Button>
        </>
      )}
    </>
  );
}
