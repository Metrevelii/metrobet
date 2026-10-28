'use client';

import { type JetRound, jetMultiplierAt } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

const POINTS = 48;
const MIN_WINDOW_MS = 10_000;

/** Calls `frame` on every animation frame while mounted. */
export function useAnimationFrame(frame: () => void, deps: unknown[]) {
  useEffect(() => {
    let id = requestAnimationFrame(function loop() {
      frame();
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `frame` is recreated every render on purpose; deps say when to restart.
  }, deps);
}

/**
 * The flight: an exponential curve with the jet at its tip and the live multiplier. Drawn with
 * refs on each animation frame (no React re-render per frame). The multiplier comes from the
 * shared formula and the server clock, so every viewer sees the same number.
 */
export function JetStage({ round, offset }: { round: JetRound; offset: number }) {
  const t = useTranslations('Originals.jet');
  const curve = useRef<SVGPathElement>(null);
  const area = useRef<SVGPathElement>(null);
  const jet = useRef<HTMLDivElement>(null);
  const multiplier = useRef<HTMLDivElement>(null);
  const countdown = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useAnimationFrame(() => {
    const now = Date.now() + offset;
    if (round.phase === 'betting') {
      const left = Math.max(0, round.bettingEndsAt - now);
      if (countdown.current)
        countdown.current.textContent = t('startsIn', { seconds: (left / 1000).toFixed(1) });
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, left / 6000)})`;
      return;
    }
    const elapsed = round.phase === 'flying' ? now - (round.startedAt ?? now) : null;
    const shown = elapsed === null ? (round.crashPoint ?? 1) : jetMultiplierAt(elapsed);
    if (multiplier.current) multiplier.current.textContent = `${shown.toFixed(2)}×`;
    if (elapsed === null) return;

    const window = Math.max(MIN_WINDOW_MS, elapsed * 1.15);
    const top = Math.max(2, shown * 1.25);
    const point = (ms: number) => {
      const x = (ms / window) * 1000;
      const y = 500 - ((jetMultiplierAt(ms) - 1) / (top - 1)) * 460;
      return [x, y] as const;
    };
    const points = Array.from({ length: POINTS + 1 }, (_, i) => point((elapsed * i) / POINTS));
    const d = points
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    curve.current?.setAttribute('d', d);
    const [tipX, tipY] = points.at(-1)!;
    area.current?.setAttribute('d', `${d} L${tipX.toFixed(1)} 500 L0 500 Z`);
    if (jet.current) {
      jet.current.style.left = `${tipX / 10}%`;
      jet.current.style.top = `${tipY / 5}%`;
    }
  }, [round, offset]);

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-background bg-glow ring-1 ring-border">
      {round.phase === 'betting' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
          <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            {t('placeBets')}
          </span>
          <div ref={countdown} className="text-3xl font-black tabular" aria-live="off" />
          <div className="h-1.5 w-2/3 max-w-xs overflow-hidden rounded-full bg-muted">
            <div ref={bar} className="h-full origin-left rounded-full bg-primary" />
          </div>
        </div>
      ) : (
        <>
          <svg
            viewBox="0 0 1000 500"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            <path ref={area} className="fill-primary/10" />
            <path
              ref={curve}
              className={cn(
                'fill-none stroke-[6]',
                round.phase === 'crashed' ? 'stroke-destructive' : 'stroke-primary',
              )}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {round.phase === 'flying' && (
            <div
              ref={jet}
              className="absolute -translate-x-1/2 -translate-y-3/4 -rotate-12 text-[clamp(1.75rem,5vw,3rem)]"
              aria-hidden
            >
              ✈️
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {round.phase === 'crashed' && (
              <span className="text-sm font-bold tracking-widest text-destructive uppercase">
                {t('flewAway')}
              </span>
            )}
            <div
              ref={multiplier}
              className={cn(
                'text-[clamp(2.5rem,9vw,5.5rem)] font-black tabular',
                round.phase === 'crashed' ? 'text-destructive' : 'text-foreground',
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
