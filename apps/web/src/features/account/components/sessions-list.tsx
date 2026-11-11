'use client';

import type { PlayerSession } from '@metrobet/contracts';
import { Badge, Button, Card, toast } from '@metrobet/ui';
import { Monitor, Smartphone } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { revokeOtherSessions, revokeSession } from '../actions';
import { describeDevice } from '../device';

/** Signed-in devices with "sign out" per device and for all the others at once. */
export function SessionsList({ sessions }: { sessions: PlayerSession[] }) {
  const t = useTranslations('Account.security');
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const others = sessions.filter((session) => !session.current).length;

  const run = (action: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t('signOutFailed'), { id: 'account-sessions' });
        return;
      }
      toast.success(t('signedOut'));
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-bold">{t('devicesTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('devicesHint')}</p>
        </div>
        {others > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(revokeOtherSessions)}
          >
            {t('signOutOthers', { count: others })}
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y">
        {sessions.map((session) => {
          const device = describeDevice(session.userAgent);
          const Icon = device.mobile ? Smartphone : Monitor;
          return (
            <li key={session.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{device.name ?? t('unknownDevice')}</span>
                  {session.current && <Badge variant="primary">{t('thisDevice')}</Badge>}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    session.ip,
                    t('lastActive', {
                      time: format.dateTime(new Date(session.lastUsedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Tbilisi',
                      }),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {!session.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => revokeSession(session.id))}
                >
                  {t('signOut')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
