'use client';

import { JET_BET_SLOTS, type JetState, type OriginalLaunch } from '@metrobet/contracts';
import { cn, Skeleton } from '@metrobet/ui';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useOriginalsSocket } from '../../use-originals-socket';
import { GameShell, useMoney } from '../game-shell';
import { BetPanel } from './bet-panel';
import { JetStage } from './jet-stage';
import { useJet } from './use-jet';

const crashTone = (point: number) =>
  point >= 10
    ? 'bg-primary text-primary-foreground'
    : point >= 2
      ? 'bg-success/20 text-success'
      : 'bg-muted text-muted-foreground';

function History({ history }: { history: JetState['history'] }) {
  const t = useTranslations('Originals.jet');
  return (
    <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label={t('history')}>
      {history.map((item) => (
        <li
          key={item.number}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular',
            crashTone(item.crashPoint),
          )}
        >
          {item.crashPoint.toFixed(2)}×
        </li>
      ))}
    </ol>
  );
}

function LiveBets({ bets }: { bets: JetState['bets'] }) {
  const t = useTranslations('Originals.jet');
  const money = useMoney();
  const players = new Set(bets.map((bet) => bet.tag)).size;
  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
      <header className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>{t('allBets', { count: players })}</span>
        <span className="tabular">{money(total)}</span>
      </header>
      {bets.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t('noBets')}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-xs">
          {bets.map((bet) => (
            <li
              key={`${bet.tag}:${bet.slot}`}
              className={cn(
                'grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 tabular',
                bet.cashedAt !== null ? 'bg-success/15' : 'bg-background/60',
              )}
            >
              <span className="font-semibold">{t('player', { tag: bet.tag })}</span>
              <span>{money(bet.amount)}</span>
              <span
                className={cn(
                  'min-w-20 text-right',
                  bet.cashedAt !== null && 'font-bold text-success',
                )}
              >
                {bet.cashedAt !== null ? `${bet.cashedAt.toFixed(2)}× · ${money(bet.win)}` : '–'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fairness({ state }: { state: JetState }) {
  const t = useTranslations('Originals.jet');
  const last = state.round.seed ? state.round : null;
  const previous = state.history[0];
  return (
    <details className="rounded-xl bg-muted/40 p-3 text-xs ring-1 ring-border">
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        {t('fair')} · {t('round', { number: state.round.number })}
      </summary>
      <div className="mt-2 flex flex-col gap-2 break-all text-muted-foreground">
        <p>{t('fairHint')}</p>
        <p>
          <span className="font-semibold text-foreground">{t('seedHash')}:</span>{' '}
          {state.round.seedHash}
        </p>
        {(last ?? previous) && (
          <p>
            <span className="font-semibold text-foreground">
              {t('lastSeed', {
                number: (last ?? previous)!.number,
                point: (last?.crashPoint ?? previous!.crashPoint).toFixed(2),
              })}
              :
            </span>{' '}
            {last?.seed ?? previous!.seed}
          </p>
        )}
      </div>
    </details>
  );
}

/** Metro Jet: shared crash rounds, two bet panels, live bets and provably fair details. */
export function MetroJet({ launch }: { launch: OriginalLaunch }) {
  const connection = useOriginalsSocket(launch);
  const { state, offset } = useJet(connection.socket);

  return (
    <GameShell title="Metro Jet" mode={launch.mode} connection={connection}>
      {!state ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="aspect-[2/1] w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <History history={state.history} />
            <JetStage round={state.round} offset={offset} />
            <div className="grid gap-3 md:grid-cols-2">
              {JET_BET_SLOTS.map((slot) => (
                <BetPanel
                  key={slot}
                  slot={slot}
                  state={state}
                  offset={offset}
                  socket={connection.socket}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <LiveBets bets={state.bets} />
            <Fairness state={state} />
          </div>
        </div>
      )}
    </GameShell>
  );
}
