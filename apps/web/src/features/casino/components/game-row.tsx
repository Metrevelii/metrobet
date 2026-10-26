'use client';

import type { GameCard } from '@metrobet/contracts';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@metrobet/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

import { GameTile } from './game-tile';

type GameRowProps = {
  title: ReactNode;
  games: GameCard[];
  viewAllHref?: string;
};

/** Horizontally scrollable row of tiles with a header, "view all" link and arrows. */
export function GameRow({ title, games, viewAllHref }: GameRowProps) {
  const t = useTranslations('Casino');
  const common = useTranslations('Common');
  return (
    <Carousel
      opts={{ align: 'start', dragFree: true, slidesToScroll: 'auto' }}
      className="@container flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">{title}</h2>
        <div className="flex items-center gap-1">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="mr-1 flex items-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('viewAll')}
              <ChevronRight className="size-4" />
            </Link>
          )}
          <CarouselPrevious label={common('previous')} className="hidden size-8 sm:inline-flex" />
          <CarouselNext label={common('next')} className="hidden size-8 sm:inline-flex" />
        </div>
      </header>
      <CarouselContent className="-ml-3">
        {games.map((game) => (
          <CarouselItem
            key={game.slug}
            className="basis-[38%] pl-3 @xl:basis-1/4 @3xl:basis-1/5 @5xl:basis-1/6"
          >
            <GameTile game={game} sizes="(min-width: 1280px) 200px, 38vw" />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
