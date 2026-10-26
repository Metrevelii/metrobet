import { EventEmitter } from 'node:events';

import {
  type CompetitionEvents,
  type EventDetail,
  type EventSummary,
  type EventUpdate,
  type Market,
  type Sport,
  SPORTS,
  type SportOverview,
  type SportSummary,
} from '@metrobet/contracts';
import { Injectable } from '@nestjs/common';

import type { FeedHandler } from './feed/odds-feed.js';

const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;
const UPCOMING_LIMIT = 60;
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

export function toSummary({ markets, ...event }: EventDetail): EventSummary {
  return {
    ...event,
    mainMarket: markets.find((m) => MAIN_MARKETS.has(m.type)) ?? null,
    marketCount: markets.length,
  };
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

  overview(sport: Sport, now = Date.now()): SportOverview {
    const events = this.sorted().filter((event) => event.sport === sport);
    return {
      live: byCompetition(events.filter((event) => event.status === 'live')),
      upcoming: byCompetition(
        events.filter((event) => this.isUpcoming(event, now)).slice(0, UPCOMING_LIMIT),
      ),
    };
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
