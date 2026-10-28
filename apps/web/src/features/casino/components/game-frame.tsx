'use client';

import { type GameDetail, type GameMode, parseOriginalLaunch } from '@metrobet/contracts';
import { Badge, Button, cn } from '@metrobet/ui';
import { ChevronLeft, Maximize, Minimize } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { OriginalGame } from '@/features/originals';
import { setLiveBalance } from '@/features/wallet/live-balance';
import { Link } from '@/i18n/navigation';

import { addRecentlyPlayed } from '../game-lists';
import { gameHref, SLOTS_HREF } from '../links';
import { FavoriteButton } from './favorite-button';

type GameFrameProps = {
  game: GameDetail;
  url: string;
  mode: GameMode;
  /** For real-money games: whether the visitor can switch to real money right now. */
  signedIn: boolean;
};

/** What a real-money game client posts to us after each round (see the mock studio's page). */
const balanceMessageSchema = z.object({
  type: z.literal('metrobet:balance'),
  balance: z.number().int().min(0),
});

/** Real money / demo switch for games that support both. Signed-out players go to log in. */
function ModeSwitch({ game, mode, signedIn }: Omit<GameFrameProps, 'url'>) {
  const t = useTranslations('Casino.launcher');
  const href = (next: GameMode) => `${gameHref(game.slug)}?mode=${next}`;
  const realHref = signedIn ? href('real') : `/login?next=${encodeURIComponent(href('real'))}`;
  return (
    <div className="flex rounded-md bg-muted p-0.5 text-xs font-semibold">
      {(['real', 'demo'] as const).map((item) => (
        <Link
          key={item}
          href={item === 'real' ? realHref : href('demo')}
          aria-current={item === mode || undefined}
          className={cn(
            'rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 transition-colors',
            item === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(item === 'real' ? 'realMode' : 'demoMode')}
        </Link>
      ))}
    </div>
  );
}

/**
 * The provider's game client in a sandboxed iframe, with a toolbar (back, real/demo switch,
 * favorite, full screen). Opening it records the game in "Recently played". In real mode the
 * header balance follows the balance the game reports.
 */
export function GameFrame({ game, url, mode, signedIn }: GameFrameProps) {
  const t = useTranslations('Casino.launcher');
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Metrobet Originals run natively (no iframe); every other provider's client is framed.
  const original = parseOriginalLaunch(url);
  const native = original !== null;

  useEffect(() => {
    if (mode !== 'real' || native) return;
    const gameOrigin = new URL(url).origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== gameOrigin || event.source !== frame.current?.contentWindow) return;
      const message = balanceMessageSchema.safeParse(event.data);
      if (message.success) setLiveBalance(message.data.balance);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mode, url, native]);

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
        {game.hasRealMoney ? (
          <ModeSwitch game={game} mode={mode} signedIn={signedIn} />
        ) : (
          <Badge variant="warning" className="hidden sm:inline-flex">
            {t('demoMode')}
          </Badge>
        )}
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

      {original ? (
        <div
          ref={stage}
          className="relative overflow-y-auto rounded-xl border bg-card [&:fullscreen]:bg-background"
        >
          <OriginalGame launch={original} />
        </div>
      ) : (
        <div
          ref={stage}
          className="relative h-[calc(100dvh-14rem)] min-h-[420px] overflow-hidden rounded-xl border bg-black lg:aspect-video lg:h-auto lg:min-h-0"
        >
          <iframe
            ref={frame}
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
      )}
      <p className="text-xs text-muted-foreground">
        {t(mode === 'real' ? 'realNote' : game.hasRealMoney ? 'demoNote' : 'demoOnlyNote')}
      </p>
    </div>
  );
}
