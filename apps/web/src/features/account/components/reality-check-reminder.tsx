'use client';

import { type PlayActivity, toMajor } from '@metrobet/contracts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  cn,
} from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { logout } from '@/features/auth/actions';
import { Link, useRouter } from '@/i18n/navigation';

import { playActivity } from '../actions';

const START_KEY = 'mb-reality-start';
const NEXT_KEY = 'mb-reality-next';
const MINUTE = 60_000;
/** The API summarises at most a day back. */
const MAX_WINDOW = 24 * 60 * MINUTE - MINUTE;

/** sessionStorage can throw (private mode, blocked storage): fall back to memory. */
const storage = {
  get(key: string) {
    try {
      const value = Number(sessionStorage.getItem(key));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: number) {
    try {
      sessionStorage.setItem(key, String(value));
    } catch {
      // The reminder still works for this page view.
    }
  },
};

/**
 * Reality check: every `minutes` of this visit (a browser-tab session), a dialog shows how long
 * the player has been here and the money staked and won since. Renders nothing until then.
 */
export function RealityCheckReminder({ minutes }: { minutes: number }) {
  const t = useTranslations('Account.reminder');
  const format = useFormatter();
  const router = useRouter();
  const [summary, setSummary] = useState<{ elapsed: number; activity: PlayActivity | null }>();

  useEffect(() => {
    if (summary) return;
    const now = Date.now();
    const start = storage.get(START_KEY) ?? now;
    storage.set(START_KEY, start);
    const next = storage.get(NEXT_KEY) ?? start + minutes * MINUTE;
    storage.set(NEXT_KEY, next);
    const timer = window.setTimeout(
      async () => {
        const since = Math.max(start, Date.now() - MAX_WINDOW);
        const activity = await playActivity(new Date(since).toISOString());
        setSummary({ elapsed: Date.now() - start, activity });
      },
      Math.max(0, next - now),
    );
    return () => window.clearTimeout(timer);
  }, [minutes, summary]);

  const later = () => {
    storage.set(NEXT_KEY, Date.now() + minutes * MINUTE);
    setSummary(undefined);
  };
  const money = (minor: number) =>
    format.number(toMajor(minor), { style: 'currency', currency: 'GEL', signDisplay: 'auto' });

  return (
    <AlertDialog open={summary !== undefined} onOpenChange={(open) => !open && later()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('title')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t('playing', { minutes: Math.round((summary?.elapsed ?? 0) / MINUTE) })}
        </AlertDialogDescription>
        {summary?.activity && (
          <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-center">
            {(
              [
                ['staked', summary.activity.stakes, false],
                ['returned', summary.activity.returns, false],
                ['net', summary.activity.net, true],
              ] as const
            ).map(([key, value, signed]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t(key)}</dt>
                <dd
                  className={cn(
                    'font-bold tabular',
                    signed && value > 0 && 'text-success',
                    signed && value < 0 && 'text-destructive',
                  )}
                >
                  {money(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <Link
          href="/wallet"
          onClick={later}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t('history')}
        </Link>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={async () => {
              await logout();
              router.push('/');
              router.refresh();
            }}
          >
            {t('logout')}
          </AlertDialogCancel>
          <AlertDialogAction className="bg-primary text-primary-foreground" onClick={later}>
            {t('continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
