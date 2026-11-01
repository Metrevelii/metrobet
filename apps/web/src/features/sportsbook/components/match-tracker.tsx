'use client';

import type { EventDetail, Incident, LiveState, MatchStats } from '@metrobet/contracts';
import { Card, cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { useEventLiveState } from '../realtime/live-store';

const STAT_ROWS: (keyof MatchStats)[] = [
  'possession',
  'shots',
  'shotsOnTarget',
  'corners',
  'yellowCards',
  'redCards',
];

/** Match minute (0–90) from the live state, for the timeline progress. */
function matchMinute(live: LiveState): number {
  if (live.period === 'HT') return 45;
  if (live.period === 'FT') return 90;
  const minute = Number.parseInt(live.clock ?? '', 10);
  return Number.isFinite(minute) ? Math.min(90, minute) : 0;
}

/** Ball for goals, a small card for bookings. */
function IncidentIcon({ type, className }: { type: Incident['type']; className?: string }) {
  if (type === 'goal') {
    return (
      <span
        aria-hidden
        className={cn(
          'block size-3 rounded-full border-2 border-primary bg-primary-foreground',
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'block h-3 w-2 rounded-[2px]',
        type === 'yellow_card' ? 'bg-warning' : 'bg-destructive',
        className,
      )}
    />
  );
}

/** Position of a match minute along the timeline. */
const at = (minute: number) => `${(minute / 90) * 100}%`;

/** 0'–90' line with the elapsed part filled and incidents above (home) or below (away). */
function Timeline({ minute, incidents }: { minute: number; incidents: Incident[] }) {
  return (
    <div className="relative h-14" role="presentation">
      {incidents.map((incident, index) => (
        <span
          key={`${incident.type}:${incident.team}:${incident.minute}:${index}`}
          style={{ left: at(incident.minute) }}
          className={cn(
            'absolute -translate-x-1/2',
            incident.team === 'home' ? 'top-0.5' : 'bottom-0.5',
          )}
        >
          <IncidentIcon type={incident.type} />
        </span>
      ))}
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-700"
          style={{ width: at(minute) }}
        />
      </div>
      {/* Half-time mark */}
      <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-border" />
      <div className="absolute inset-x-0 -bottom-4 flex justify-between text-[10px] text-muted-foreground tabular">
        <span>0'</span>
        <span>45'</span>
        <span>90'</span>
      </div>
    </div>
  );
}

/** One stat: values at both ends, label in the middle, bars growing towards the centre. */
function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const share = (value: number) => (total === 0 ? 0 : (value / total) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-bold tabular', home > away && 'text-primary')}>{home}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-bold tabular', away > home && 'text-primary')}>{away}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              home >= away ? 'bg-primary' : 'bg-muted-foreground/50',
            )}
            style={{ width: `${share(home)}%` }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              away >= home ? 'bg-primary' : 'bg-muted-foreground/50',
            )}
            style={{ width: `${share(away)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Live match tracker for football and eSoccer: incident timeline, team stats and the list of
 * goals and cards. Renders nothing for sports (or feeds) without tracker data.
 */
export function MatchTracker({ event }: { event: EventDetail }) {
  const t = useTranslations('Sports.tracker');
  const { status, live } = useEventLiveState(event);
  if (status === 'scheduled' || !live?.stats) return null;

  const incidents = live.incidents ?? [];
  const team = (side: Incident['team']) => (side === 'home' ? event.home.name : event.away.name);

  return (
    <Card className="flex flex-col gap-5 p-4 md:p-5">
      <div className="flex items-center justify-between text-sm font-bold">
        <h2>{t('title')}</h2>
        <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
          <span className="truncate">{event.home.name}</span>
          <span>·</span>
          <span className="truncate">{event.away.name}</span>
        </div>
      </div>

      <div className="pb-4">
        <Timeline minute={matchMinute(live)} incidents={incidents} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {STAT_ROWS.map((key) => (
            <StatRow
              key={key}
              label={key === 'possession' ? `${t('stats.possession')} %` : t(`stats.${key}`)}
              home={live.stats![key].home}
              away={live.stats![key].away}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">{t('events')}</h3>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noIncidents')}</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {incidents.toReversed().map((incident, index) => (
                <li
                  key={`${incident.type}:${incident.team}:${incident.minute}:${index}`}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    incident.team === 'away' && 'flex-row-reverse text-right',
                  )}
                >
                  <span className="w-8 shrink-0 text-xs font-bold text-muted-foreground tabular">
                    {incident.minute}'
                  </span>
                  <IncidentIcon type={incident.type} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{t(`incidents.${incident.type}`)}</span>
                    <span className="text-muted-foreground"> · {team(incident.team)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}
