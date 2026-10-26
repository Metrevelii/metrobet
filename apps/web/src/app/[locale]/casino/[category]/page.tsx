import { CASINO_CATEGORIES, casinoCategorySchema } from '@metrobet/contracts';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { CasinoPage, GameGridSkeleton, GamesListing } from '@/features/casino';

type Props = PageProps<'/[locale]/casino/[category]'>;

export function generateStaticParams() {
  return CASINO_CATEGORIES.map((category) => ({ category }));
}

async function resolveCategory(params: Props['params']) {
  const parsed = casinoCategorySchema.safeParse((await params).category);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [category, t] = await Promise.all([resolveCategory(params), getTranslations('Casino')]);
  return { title: t(`categories.${category}`) };
}

async function CategoryView({ params }: Pick<Props, 'params'>) {
  const [category, t] = await Promise.all([resolveCategory(params), getTranslations('Casino')]);
  return (
    <CasinoPage active={category} title={t(`categories.${category}`)}>
      <Suspense fallback={<GameGridSkeleton />}>
        <GamesListing query={{ category }} />
      </Suspense>
    </CasinoPage>
  );
}

/** Params are awaited inside Suspense so navigations stay instant (categories still prerender). */
export default function CasinoCategoryPage({ params }: Props) {
  return (
    <Suspense fallback={<GameGridSkeleton />}>
      <CategoryView params={params} />
    </Suspense>
  );
}
