'use client';

import { type PromoBlockViewOf, toMajor, type WheelState } from '@metrobet/contracts';
import { Button, buttonVariants, cn } from '@metrobet/ui';
import { FlaskConical, Gift, LoaderCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';

import { simulateBet, type SpinError, spinWheel } from '../../actions';
import { promotionPageHref } from '../../links';
import { WheelGraphic } from './wheel-graphic';

const SPIN_MS = 5000;
const EXTRA_TURNS = 5;

const mod360 = (value: number) => ((value % 360) + 360) % 360;

/** Rotation (≥ EXTRA_TURNS more turns) that stops the wheel with `index` under the top pointer. */
function rotationFor(current: number, index: number, count: number): number {
  const size = 360 / count;
  // Land anywhere in the middle 60% of the segment, so it doesn't always stop dead centre.
  const landing = (index + 0.5) * size + (Math.random() - 0.5) * size * 0.6;
  return current + EXTRA_TURNS * 360 + mod360(-landing - current);
}

type PromoWheelProps = {
  slug: string;
  block: PromoBlockViewOf<'wheel'>;
  gameName: string;
  /** null = signed out. */
  initialState: WheelState | null;
  /** Show the "simulate a bet" helper (development builds only). */
  devTools: boolean;
};

export function PromoWheel({ slug, block, gameName, initialState, devTools }: PromoWheelProps) {
  const t = useTranslations('Promotions.wheel');
  const format = useFormatter();
  const [state, setState] = useState(initialState);
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const [error, setError] = useState<SpinError | null>(null);
  const [simulating, startSimulating] = useTransition();

  const money = (minor: number) =>
    format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });
  const step = block.earn.stepAmount;
  const games = format.list(block.earn.gameTypes.map((type) => t(`gameTypes.${type}`)));

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    setWon(null);
    setError(null);
    const result = await spinWheel(slug, block.id);
    if (!result.ok) {
      setError(result.error);
      setSpinning(false);
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduceMotion ? 0 : SPIN_MS;
    setDuration(ms);
    setRotation((current) => rotationFor(current, result.data.segmentIndex, block.segments.length));
    // A timer rather than transitionend: it also fires when the animation is skipped.
    setTimeout(() => {
      setState(result.data.state);
      setWon(result.data.freeSpins);
      setSpinning(false);
    }, ms);
  };

  const simulate = () =>
    startSimulating(async () => {
      const next = await simulateBet(slug, block.id, {
        gameSlug: block.freeSpinsGame,
        amount: step,
      });
      if (next) setState(next);
    });

  return (
    <div className="grid items-center gap-6 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,340px)_1fr] md:p-6">
      <WheelGraphic
        labels={block.segments.map(({ freeSpins }) => String(freeSpins))}
        unit={t('unit')}
        rotation={rotation}
        duration={duration}
        className="mx-auto max-w-80"
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{block.title}</h2>
          <p className="text-sm text-muted-foreground">
            {t('earnRule', { amount: money(step), games })}
          </p>
          <p className="text-sm text-muted-foreground">{t('prizeRule', { game: gameName })}</p>
        </div>

        {state === null ? (
          <Link
            href={{ pathname: '/login', query: { next: promotionPageHref(slug) } }}
            className={cn(buttonVariants({ size: 'lg' }), 'self-start')}
          >
            {t('login')}
          </Link>
        ) : !state.eligible ? (
          <p className="rounded-md bg-secondary px-4 py-3 text-sm font-medium">{t('joinFirst')}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-md bg-secondary p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-muted-foreground">{t('spinsAvailable')}</span>
                <span className="text-3xl font-bold text-primary tabular-nums">
                  {state.spinsAvailable}
                </span>
              </div>
              <progress
                max={step}
                value={step - state.toNextSpin}
                aria-label={t('progressLabel')}
                className="h-2 w-full appearance-none overflow-hidden rounded-full bg-background [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-background [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
              />
              <p className="text-xs text-muted-foreground">
                {t('toNextSpin', { amount: money(state.toNextSpin) })}
              </p>
            </div>

            <Button
              size="lg"
              onClick={spin}
              disabled={spinning || state.spinsAvailable === 0}
              className="self-start"
            >
              {spinning && <LoaderCircle className="animate-spin" />}
              {spinning ? t('spinning') : t('spin')}
            </Button>
          </>
        )}

        <div aria-live="polite">
          {won !== null && (
            <p className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold">
              <Gift className="size-4 text-primary" />
              {t('won', { count: won, game: gameName })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
        </div>

        {state && state.wins.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t('wins')}</h3>
            <ul className="flex flex-col divide-y rounded-md border text-sm">
              {state.wins.map((win) => (
                <li key={win.wonAt} className="flex justify-between gap-4 px-3 py-2">
                  <span className="font-semibold">{t('winItem', { count: win.freeSpins })}</span>
                  <span className="text-muted-foreground">
                    {format.relativeTime(new Date(win.wonAt))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {devTools && state && (
          <Button
            variant="outline"
            size="sm"
            onClick={simulate}
            disabled={simulating}
            className="self-start border-dashed"
          >
            <FlaskConical />
            {t('simulate', { amount: money(step) })}
          </Button>
        )}
      </div>
    </div>
  );
}
