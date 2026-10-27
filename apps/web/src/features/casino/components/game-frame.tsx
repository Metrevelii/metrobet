'use client';

import type { GameDetail } from '@metrobet/contracts';
import { Badge, Button } from '@metrobet/ui';
import { ChevronLeft, Maximize, Minimize } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Link } from '@/i18n/navigation';

import { addRecentlyPlayed } from '../game-lists';
import { SLOTS_HREF } from '../links';
import { FavoriteButton } from './favorite-button';

type GameFrameProps = { game: GameDetail; url: string };

/**
 * The provider's game client in a sandboxed iframe, with a toolbar (back, favorite,
 * full screen). Opening it records the game in "Recently played".
 */
export function GameFrame({ game, url }: GameFrameProps) {
  const t = useTranslations('Casino.launcher');
  const stage = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const { rtp: _rtp, volatility: _volatility, ...card } = game;
    addRecentlyPlayed(card);
  }, [game]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () =>
    document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={SLOTS_HREF} aria-label={t('back')}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{game.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {game.provider.name}
            {game.rtp !== null && ` · ${t('rtp', { value: game.rtp })}`}
          </p>
        </div>
        <Badge variant="warning" className="hidden sm:inline-flex">
          {t('demoMode')}
        </Badge>
        <FavoriteButton game={game} className="bg-muted" />
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={t(fullscreen ? 'exitFullscreen' : 'fullscreen')}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </div>

      <div
        ref={stage}
        className="relative h-[calc(100dvh-14rem)] min-h-[420px] overflow-hidden rounded-xl border bg-black lg:aspect-video lg:h-auto lg:min-h-0"
      >
        <iframe
          src={url}
          title={game.name}
          className="absolute inset-0 size-full"
          allow="fullscreen; autoplay; clipboard-write"
          // Game clients are cross-origin and need scripts + their own storage; the sandbox still
          // blocks top navigation and any access to our origin.
          // oxlint-disable-next-line react/iframe-missing-sandbox
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('realMoneyNote')}</p>
    </div>
  );
}
