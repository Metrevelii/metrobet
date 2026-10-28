'use client';

import { type GameMode, type OriginalsError, toMajor } from '@metrobet/contracts';
import { Badge, Skeleton } from '@metrobet/ui';
import { PlugZap } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { OriginalsConnection } from '../use-originals-socket';

const KNOWN_ERRORS = [
  'INSUFFICIENT_FUNDS',
  'WRONG_PHASE',
  'ALREADY_BET',
  'NO_BET',
  'SESSION_EXPIRED',
  'PLAYER_BLOCKED',
] as const;

/** Translated message for a game server error code (anything unexpected reads as generic). */
export function useGameError() {
  const t = useTranslations('Originals.errors');
  return (code: OriginalsError) =>
    t(
      (KNOWN_ERRORS as readonly string[]).includes(code)
        ? (code as (typeof KNOWN_ERRORS)[number])
        : 'generic',
    );
}

/** Formats minor units as GEL. */
export function useMoney() {
  const format = useFormatter();
  return (minor: number) => format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });
}

type GameShellProps = {
  title: string;
  mode: GameMode;
  connection: OriginalsConnection;
  children: ReactNode;
};

/** Common frame of an Originals game: title, balance (real or demo), connection states. */
export function GameShell({ title, mode, connection, children }: GameShellProps) {
  const t = useTranslations('Originals');
  const money = useMoney();

  if (connection.status === 'failed') {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PlugZap className="size-6" />
        </div>
        <p className="font-semibold">{t('sessionEnded')}</p>
        <p className="max-w-72 text-sm text-muted-foreground">{t('sessionEndedHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black tracking-[0.25em] text-muted-foreground uppercase">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {mode === 'demo' && <Badge variant="warning">{t('demo')}</Badge>}
          <span className="rounded-md bg-muted px-3 py-1.5 text-sm">
            {t('balance')}{' '}
            {connection.balance === null ? (
              <Skeleton className="inline-block h-4 w-14 align-middle" />
            ) : (
              <b className="tabular">{money(connection.balance)}</b>
            )}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
