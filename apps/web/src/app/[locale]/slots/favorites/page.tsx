import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CasinoPage, FavoritesGrid } from '@/features/casino';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Casino');
  return { title: t('favorites'), robots: { index: false } };
}

export default async function CasinoFavoritesPage() {
  const t = await getTranslations('Casino');
  return (
    <CasinoPage active="favorites" title={t('favorites')}>
      <FavoritesGrid />
    </CasinoPage>
  );
}
