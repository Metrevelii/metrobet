import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  CasinoPage,
  categoryParam,
  GameGridSkeleton,
  GamesListing,
  getProviders,
} from '@/features/casino';

type Props = PageProps<'/[locale]/slots/providers/[provider]'>;

async function findProvider(params: Props['params']) {
  const { provider } = await params;
  return (await getProviders()).find((item) => item.slug === provider) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = await findProvider(params);
  return provider ? { title: provider.name } : {};
}

/** A provider tab: that provider's slots, filtered by the category chip. */
async function ProviderSlots({ params, searchParams }: Props) {
  const [provider, category] = await Promise.all([
    findProvider(params),
    searchParams.then((query) => categoryParam(query.category)),
  ]);
  if (!provider) notFound();
  return (
    <CasinoPage tab={provider.slug} chip={category}>
      <h1 className="sr-only">{provider.name}</h1>
      <Suspense key={category} fallback={<GameGridSkeleton />}>
        <GamesListing query={{ type: 'slot', provider: provider.slug, category }} />
      </Suspense>
    </CasinoPage>
  );
}

export default function ProviderPage(props: Props) {
  return (
    <Suspense fallback={<GameGridSkeleton />}>
      <ProviderSlots {...props} />
    </Suspense>
  );
}
