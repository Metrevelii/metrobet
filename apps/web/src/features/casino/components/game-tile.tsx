import type { GameCard } from '@metrobet/contracts';
import { Badge, type BadgeProps } from '@metrobet/ui';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import { Link } from '@/i18n/navigation';

import { gameHref } from '../links';
import { FavoriteButton } from './favorite-button';

const TAG_VARIANT: Record<GameCard['tags'][number], BadgeProps['variant']> = {
  new: 'primary',
  hot: 'destructive',
  jackpot: 'warning',
};

type GameTileProps = {
  game: GameCard;
  /** Rendered sizes hint for the thumbnail. */
  sizes?: string;
};

/** Cover art with badges, favorite toggle and a play overlay. The whole art is the play link. */
export function GameTile({ game, sizes = '(min-width: 1280px) 200px, 33vw' }: GameTileProps) {
  const t = useTranslations('Casino');
  return (
    <div className="group/tile relative flex flex-col gap-2">
      <div className="relative aspect-3/4 overflow-hidden rounded-lg bg-muted">
        <Image
          src={game.thumbnail}
          alt=""
          fill
          sizes={sizes}
          unoptimized={game.thumbnail.endsWith('.svg')}
          className="object-cover transition-transform duration-500 group-hover/tile:scale-105"
        />
        <Link
          href={gameHref(game.slug)}
          aria-label={`${t('play')}: ${game.name}`}
          className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors group-hover/tile:bg-background/55 focus-visible:bg-background/55"
        >
          <span className="flex size-12 scale-75 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-glow transition-all group-focus-within/tile:scale-100 group-focus-within/tile:opacity-100 group-hover/tile:scale-100 group-hover/tile:opacity-100">
            <Play className="size-5 translate-x-px fill-current" />
          </span>
        </Link>
        {game.tags.length > 0 && (
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1">
            {game.tags.map((tag) => (
              <Badge key={tag} variant={TAG_VARIANT[tag]}>
                {t(`tags.${tag}`)}
              </Badge>
            ))}
          </div>
        )}
        <FavoriteButton game={game} className="absolute top-2 right-2" />
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold">{game.name}</p>
        <p className="truncate text-xs text-muted-foreground">{game.provider.name}</p>
      </div>
    </div>
  );
}
