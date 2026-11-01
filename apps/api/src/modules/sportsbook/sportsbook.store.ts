import { EventEmitter } from 'node:events';

import {
  type CompetitionEvents,
  type CompetitionSummary,
  DAY_MS,
  type DayFilter,
  type EventDetail,
  type EventSummary,
  type EventUpdate,
  type Market,
  type Sport,
  SPORTS,
  type SportOverview,
  type SportSummary,
  TABLE_COLUMNS,
  tbilisiDayStart,
} from '@metrobet/contracts';
import { Injectable } from '@nestjs/common';

import type { FeedHandler } from './feed/odds-feed.js';

const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;
const UPCOMING_LIMIT = 60;
/** With a day or league filter the list is shorter, so more of it can be shown. */
const FILTERED_LIMIT = 200;
const SOON_MS = 60 * 60 * 1000;
const MAIN_MARKETS = new Set(['1x2', 'moneyline']);

const sameMarket = (a: Market | undefined, b: Market) =>
  a !== undefined &&
  a.status === b.status &&
  JSON.stringify(a.selections) === JSON.stringify(b.selections);

const closeMarket = (market: Market): Market => ({
  ...market,
  status: 'closed',
  selections: market.selections.map((selection) => ({ ...selection, active: false })),
});

/** How far a market is from even odds (its "main line" is the most balanced one). */
const imbalance = (market: Market) => {
  const [a, b] = market.selections;
  return a && b ? Math.abs(a.odds - b.odds) : Number.POSITIVE_INFINITY;
};

/** The markets shown as match table columns: one per TABLE_COLUMNS group, main line first. */
export function tableMarkets(event: EventDetail): Market[] {
  return TABLE_COLUMNS[event.sport].flatMap(({ type }) => {
    const candidates = event.markets.filter((market) => market.type === type);
    const open = candidates.filter((market) => market.status !== 'closed');
    const [best] = (open.length > 0 ? open : candidates).toSorted(
      (a, b) => imbalance(a) - imbalance(b),
    );
    return best ? [best] : [];
  });
}

export function toSummary(event: EventDetail): EventSummary {
  const { markets, live, ...rest } = event;
  // The match tracker (stats, incidents) is for the event page only; lists stay small.
  return {
    ...rest,
    live: live && {
      period: live.period,
      clock: live.clock,
      score: live.score,
      periodScores: live.periodScores,
    },
    mainMarket: markets.find((m) => MAIN_MARKETS.has(m.type)) ?? null,
    markets: tableMarkets(event),
    marketCount: markets.length,
  };
}

/** Start/end (ms) of the upcoming window a day filter allows, or null for live-only rules. */
function dayWindow(day: DayFilter, now: number): [number, number] {
  const today = tbilisiDayStart(now).getTime();
  switch (day) {
    case 'today':
      return [now, today + DAY_MS];
    case 'tomorrow':
      return [today + DAY_MS, today + 2 * DAY_MS];
    case 'soon':
      return [now, now + SOON_MS];
    case 'all':
      return [now, now + UPCOMING_WINDOW_MS];
  }
}

/** Groups events by competition, keeping the order in which competitions first appear. */
function byCompetition(events: EventDetail[]): CompetitionEvents[] {
  const groups = new Map<string, CompetitionEvents>();
  for (const event of events) {
    const group = groups.get(event.competition.id) ?? {
      competition: event.competition,
      events: [],
    };
    group.events.push(toSummary(event));
    groups.set(event.competition.id, group);
  }
  return [...groups.values()];
}

type StoreEvents = { update: [EventUpdate]; 'live-changed': [] };

/**
 * Current sportsbook state (in memory, fed by the OddsFeed). Diffs every feed update and emits
 * only what changed. Move to Redis when the API runs on several instances.
 */
@Injectable()
export class SportsbookStore implements FeedHandler {
  private readonly events = new Map<string, EventDetail>();
  private readonly emitter = new EventEmitter<StoreEvents>();
  private liveChangePending = false;

  on<K extends keyof StoreEvents>(event: K, listener: (...args: StoreEvents[K]) => void) {
    this.emitter.on(event, listener as never);
    return () => this.emitter.off(event, listener as never);
  }

  upsert(next: EventDetail) {
    const prev = this.events.get(next.id);
    this.events.set(next.id, next);
    if (!prev) {
      if (next.status === 'live') this.liveChanged();
      return;
    }

    const prevMarkets = new Map(prev.markets.map((market) => [market.id, market]));
    const nextIds = new Set(next.markets.map((market) => market.id));
    const markets = [
      ...next.markets.filter((market) => !sameMarket(prevMarkets.get(market.id), market)),
      // A market that disappears (e.g. the previous set's winner) is closed for clients.
      ...prev.markets.filter((market) => !nextIds.has(market.id)).map(closeMarket),
    ];
    const stateChanged =
      prev.status !== next.status || JSON.stringify(prev.live) !== JSON.stringify(next.live);

    if (prev.status !== next.status && (prev.status === 'live' || next.status === 'live'))
      this.liveChanged();
    if (markets.length > 0 || stateChanged) {
      this.emitter.emit('update', {
        eventId: next.id,
        status: next.status,
        live: next.live,
        markets,
      });
    }
  }

  remove(eventId: string) {
    const prev = this.events.get(eventId);
    this.events.delete(eventId);
    if (prev?.status === 'live') this.liveChanged();
  }

  sports(now = Date.now()): SportSummary[] {
    const events = [...this.events.values()];
    return SPORTS.map((sport) => ({
      sport,
      liveCount: events.filter((e) => e.sport === sport && e.status === 'live').length,
      upcomingCount: events.filter((e) => e.sport === sport && this.isUpcoming(e, now)).length,
    }));
  }

  /**
   * Live and upcoming events of a sport, by competition. `day` limits upcoming events to a
   * Tbilisi day (`today` keeps live matches, `tomorrow` and `soon` leave them out);
   * `competitions` keeps only those leagues.
   */
  overview(
    sport: Sport,
    { day = 'all', competitions = [] }: { day?: DayFilter; competitions?: string[] } = {},
    now = Date.now(),
  ): SportOverview {
    const leagues = new Set(competitions);
    const events = this.sorted().filter(
      (event) => event.sport === sport && (leagues.size === 0 || leagues.has(event.competition.id)),
    );
    const [from, to] = dayWindow(day, now);
    const showLive = day === 'all' || day === 'today';
    const limit = day === 'all' && leagues.size === 0 ? UPCOMING_LIMIT : FILTERED_LIMIT;
    return {
      live: showLive ? byCompetition(events.filter((event) => event.status === 'live')) : [],
      upcoming: byCompetition(
        events
          .filter((event) => {
            const starts = Date.parse(event.startsAt);
            return event.status === 'scheduled' && starts >= from && starts < to;
          })
          .slice(0, limit),
      ),
    };
  }

  /** Competitions of a sport with live / upcoming counts, for the league navigation. */
  competitions(sport: Sport, now = Date.now()): CompetitionSummary[] {
    const groups = new Map<string, CompetitionSummary>();
    for (const event of this.sorted()) {
      if (event.sport !== sport) continue;
      const group = groups.get(event.competition.id) ?? {
        competition: event.competition,
        liveCount: 0,
        upcomingCount: 0,
      };
      if (event.status === 'live') group.liveCount += 1;
      else if (this.isUpcoming(event, now)) group.upcomingCount += 1;
      groups.set(event.competition.id, group);
    }
    return [...groups.values()];
  }

  live(): CompetitionEvents[] {
    return SPORTS.flatMap((sport) =>
      byCompetition(
        this.sorted().filter((event) => event.sport === sport && event.status === 'live'),
      ),
    );
  }

  event(id: string): EventDetail | undefined {
    return this.events.get(id);
  }

  /**
   * A selection with its market and event, by selection id (`<eventId>:<type>:<line>:<key>`),
   * or null when the event is not in the feed any more.
   */
  findSelection(selectionId: string) {
    const event = this.events.get(selectionId.split(':').slice(0, -3).join(':'));
    for (const market of event?.markets ?? []) {
      const selection = market.selections.find((item) => item.id === selectionId);
      if (selection) return { event: event!, market, selection };
    }
    return null;
  }

  /** Current full state of the given events, for clients that just subscribed. */
  snapshot(eventIds: string[]): EventUpdate[] {
    return eventIds.flatMap((id) => {
      const event = this.events.get(id);
      return event
        ? [{ eventId: id, status: event.status, live: event.live, markets: event.markets }]
        : [];
    });
  }

  private isUpcoming(event: EventDetail, now: number) {
    return event.status === 'scheduled' && Date.parse(event.startsAt) - now < UPCOMING_WINDOW_MS;
  }

  private sorted() {
    return [...this.events.values()].toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  /** Coalesces many transitions in one feed tick into a single notification. */
  private liveChanged() {
    if (this.liveChangePending) return;
    this.liveChangePending = true;
    setImmediate(() => {
      this.liveChangePending = false;
      this.emitter.emit('live-changed');
    });
  }
}
