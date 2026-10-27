import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import {
  CasinoPage,
  categoryHref,
  GameRow,
  getLobby,
  providerHref,
  RecentlyPlayedRow,
} from '@/features/casino';
import { PromotionsSlider } from '@/features/promotions';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('slots') };
}

async function LobbyRows() {
  const [lobby, t] = await Promise.all([getLobby(), getTranslations('Casino')]);
  return (
    <>
      {lobby.sections.map(({ category, games }) => (
        <GameRow
          key={category}
          title={t(`categories.${category}`)}
          games={games}
          viewAllHref={categoryHref(category)}
        />
      ))}
      {lobby.providers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{t('providers')}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {lobby.providers.map((provider) => (
              <li key={provider.slug}>
                <Link
                  href={providerHref(provider.slug)}
                  className="flex h-full flex-col gap-1 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <span className="truncate font-semibold">{provider.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('gamesCount', { count: provider.gameCount })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function LobbySkeleton() {
  return Array.from({ length: 3 }, (_, row) => (
    <div key={row} className="flex flex-col gap-3">
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 6 }, (__, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg max-sm:[&:nth-child(n+4)]:hidden" />
        ))}
      </div>
    </div>
  ));
}

export default async function CasinoLobbyPage() {
  const t = await getTranslations('Nav');
  return (
    <CasinoPage active="lobby" top={<PromotionsSlider placement="casino" />}>
      <h1 className="sr-only">{t('slots')}</h1>
      <RecentlyPlayedRow />
      <Suspense fallback={<LobbySkeleton />}>
        <LobbyRows />
      </Suspense>
    </CasinoPage>
  );
}
