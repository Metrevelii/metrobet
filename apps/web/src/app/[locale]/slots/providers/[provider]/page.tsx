import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { CasinoPage, GameGridSkeleton, GamesListing, getProviders } from '@/features/casino';

type Props = PageProps<'/[locale]/slots/providers/[provider]'>;

async function findProvider(params: Props['params']) {
  const { provider } = await params;
  return (await getProviders()).find((item) => item.slug === provider) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = await findProvider(params);
  return provider ? { title: provider.name } : {};
}

async function ProviderGames({ params }: Pick<Props, 'params'>) {
  const provider = await findProvider(params);
  if (!provider) notFound();
  return (
    <CasinoPage provider={provider.slug} title={provider.name}>
      <Suspense fallback={<GameGridSkeleton />}>
        <GamesListing query={{ type: 'slot', provider: provider.slug }} />
      </Suspense>
    </CasinoPage>
  );
}

export default function CasinoProviderPage({ params }: Props) {
  return (
    <Suspense fallback={<GameGridSkeleton />}>
      <ProviderGames params={params} />
    </Suspense>
  );
}
