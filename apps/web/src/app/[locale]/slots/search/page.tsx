import { Card } from '@metrobet/ui';
import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { CasinoPage, GameGridSkeleton, GamesListing } from '@/features/casino';

type Props = PageProps<'/[locale]/slots/search'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Casino');
  return { title: t('searchPlaceholder'), robots: { index: false } };
}

async function SearchResults({ searchParams }: Pick<Props, 'searchParams'>) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 50) ?? '';
  const t = await getTranslations('Casino');

  return (
    <CasinoPage query={query} title={query.length >= 2 ? t('searchTitle', { query }) : undefined}>
      {query.length >= 2 ? (
        <Suspense key={query} fallback={<GameGridSkeleton />}>
          <GamesListing query={{ type: 'slot', search: query }} />
        </Suspense>
      ) : (
        <Card>
          <EmptyState icon={Search} title={t('searchHint')} />
        </Card>
      )}
    </CasinoPage>
  );
}

export default function CasinoSearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<GameGridSkeleton />}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}
