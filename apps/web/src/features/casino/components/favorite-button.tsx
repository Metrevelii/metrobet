'use client';

import type { GameCard } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { toggleFavorite, useGameList } from '../game-lists';

export function FavoriteButton({ game, className }: { game: GameCard; className?: string }) {
  const t = useTranslations('Casino');
  const favorites = useGameList('favorites');
  const active = favorites?.some((item) => item.slug === game.slug) ?? false;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={t(active ? 'removeFavorite' : 'addFavorite')}
      onClick={() => toggleFavorite(game)}
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center rounded-full bg-background/60 backdrop-blur-sm transition-colors hover:bg-background/80',
        active ? 'text-destructive' : 'text-foreground',
        className,
      )}
    >
      <Heart className={cn('size-4', active && 'fill-current')} />
    </button>
  );
}
