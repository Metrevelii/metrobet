'use client';

import { Card } from '@metrobet/ui';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/shared/empty-state';

import { useGameList } from '../game-lists';
import { GameGrid, GameGridSkeleton } from './game-grid';

export function FavoritesGrid() {
  const t = useTranslations('Casino');
  const favorites = useGameList('favorites');

  if (favorites === null) return <GameGridSkeleton count={6} />;
  if (favorites.length === 0) {
    return (
      <Card>
        <EmptyState icon={Heart} title={t('favoritesEmpty')} description={t('favoritesHint')} />
      </Card>
    );
  }
  return <GameGrid games={favorites} />;
}
