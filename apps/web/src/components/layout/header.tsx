import { Button, Skeleton } from '@metrobet/ui';
import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { HeaderAccount } from '@/features/auth';

import { HeaderTabs } from './header-tabs';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';

export async function Header() {
  const t = await getTranslations('Header');
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4">
        <Logo />
        <HeaderTabs />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label={t('search')}>
            <Search />
          </Button>
          <LocaleSwitcher className="hidden sm:flex" />
          <Suspense fallback={<Skeleton className="h-8 w-36 rounded-md" />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
