'use client';

import { CRASH_BETTING_MS, crashMultiplierAt } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import type { CrashStageProps } from '../crash/crash-game';
import { useAnimationFrame } from '../crash/use-animation-frame';
import { sceneFrame } from './frame';

/**
 * Longshot's picture: the Pixi scene (ballista, bolt, dragon) with the multiplier and countdown
 * drawn over it in HTML. Pixi loads only in the browser. The scene reads the latest round from a
 * ref on every tick, so new server states never restart it.
 */
export function LongshotStage({ round, offset }: CrashStageProps) {
  const t = useTranslations('Originals.longshot');
  const tCrash = useTranslations('Originals.crash');
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ round, offset });
  const multiplier = useRef<HTMLDivElement>(null);
  const countdown = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current = { round, offset };
  }, [round, offset]);

  useEffect(() => {
    const element = host.current!;
    let disposed = false;
    let teardown = () => {};

    void (async () => {
      const [{ Application }, { LongshotScene }, { readPalette }] = await Promise.all([
        import('pixi.js'),
        import('./scene'),
        import('./palette'),
      ]);
      const app = new Application();
      await app.init({
        resizeTo: element,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      const scene = new LongshotScene(readPalette(element));
      scene.init(app);
      element.appendChild(app.canvas);
      scene.resize(app.screen.width, app.screen.height);
      const observer = new ResizeObserver(() => {
        app.resize();
        scene.resize(app.screen.width, app.screen.height);
      });
      observer.observe(element);
      app.ticker.add((ticker) => {
        const { round: current, offset: skew } = latest.current;
        scene.render(sceneFrame(current, Date.now() + skew), ticker.deltaMS);
      });
      teardown = () => {
        observer.disconnect();
        scene.destroy();
        app.destroy(true, { children: true });
      };
    })();

    return () => {
      disposed = true;
      teardown();
    };
  }, []);

  useAnimationFrame(() => {
    const now = Date.now() + offset;
    if (round.phase === 'betting') {
      const left = Math.max(0, round.bettingEndsAt - now);
      if (countdown.current) {
        countdown.current.textContent = tCrash('startsIn', { seconds: (left / 1000).toFixed(1) });
      }
      if (bar.current)
        bar.current.style.transform = `scaleX(${Math.min(1, left / CRASH_BETTING_MS)})`;
      return;
    }
    const shown =
      round.phase === 'crashed'
        ? (round.crashPoint ?? 1)
        : crashMultiplierAt(now - (round.startedAt ?? now));
    if (multiplier.current) multiplier.current.textContent = `${shown.toFixed(2)}×`;
  }, [round, offset]);

  return (
    // The scene is a night sky: always resolve theme tokens in dark mode here.
    <div
      data-mode="dark"
      className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-background ring-1 ring-border"
    >
      <div ref={host} className="absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
        {round.phase === 'betting' ? (
          <>
            <span className="text-sm font-semibold tracking-widest text-foreground/80 uppercase drop-shadow">
              {t('preparing')}
            </span>
            <div
              ref={countdown}
              className="text-3xl font-black text-foreground tabular drop-shadow"
            />
            <div className="h-1.5 w-2/3 max-w-xs overflow-hidden rounded-full bg-background/60">
              <div ref={bar} className="h-full origin-left rounded-full bg-primary" />
            </div>
          </>
        ) : (
          <>
            {round.phase === 'crashed' && (
              <span className="text-sm font-bold tracking-widest text-destructive uppercase drop-shadow">
                {t('crashed')}
              </span>
            )}
            <div
              ref={multiplier}
              className={cn(
                'text-[clamp(2.5rem,9vw,5.5rem)] font-black tabular drop-shadow-lg',
                round.phase === 'crashed' ? 'text-destructive' : 'text-foreground',
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
