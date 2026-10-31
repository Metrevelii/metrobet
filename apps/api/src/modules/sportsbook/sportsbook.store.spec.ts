import type { EventDetail, EventUpdate, Market } from '@metrobet/contracts';

import { SportsbookStore, tableMarkets } from './sportsbook.store.js';

const market = (id: string, odds: number, status: Market['status'] = 'open'): Market => ({
  id,
  type: '1x2',
  line: null,
  status,
  selections: [{ id: `${id}:home`, key: 'home', odds, active: true }],
});

const event = (markets: Market[], status: EventDetail['status'] = 'scheduled'): EventDetail => ({
  id: 'e1',
  sport: 'football',
  competition: { id: 'c', name: 'C', country: 'X', sport: 'football' },
  home: { name: 'A', abbreviation: 'A' },
  away: { name: 'B', abbreviation: 'B' },
  startsAt: '2026-10-27T12:00:00.000Z',
  status,
  live: null,
  markets,
});

const total = (line: number, over: number, under: number): Market => ({
  id: `t${line}`,
  type: 'total',
  line,
  status: 'open',
  selections: [
    { id: `t${line}:over`, key: 'over', odds: over, active: true },
    { id: `t${line}:under`, key: 'under', odds: under, active: true },
  ],
});
const ids = (overview: ReturnType<SportsbookStore['overview']>) => ({
  live: overview.live.flatMap((g) => g.events.map((e) => e.id)),
  upcoming: overview.upcoming.flatMap((g) => g.events.map((e) => e.id)),
});

describe('SportsbookStore', () => {
  it('emits only changed markets, and closes markets that disappear', () => {
    const store = new SportsbookStore();
    const updates: EventUpdate[] = [];
    store.on('update', (update) => updates.push(update));

    store.upsert(event([market('m1', 2), market('m2', 3)]));
    expect(updates).toHaveLength(0);

    store.upsert(event([market('m1', 2), market('m2', 3)]));
    expect(updates).toHaveLength(0);

    store.upsert(event([market('m1', 2.1)]));
    expect(updates).toHaveLength(1);
    expect(updates[0]!.markets.map((m) => [m.id, m.status])).toEqual([
      ['m1', 'open'],
      ['m2', 'closed'],
    ]);
  });

  it('notifies once when the live set changes', async () => {
    const store = new SportsbookStore();
    let notified = 0;
    store.on('live-changed', () => (notified += 1));
    store.upsert(event([market('m1', 2)]));
    store.upsert(event([market('m1', 2)], 'live'));
    store.remove('e1');
    await new Promise((resolve) => setImmediate(resolve));
    expect(notified).toBe(1);
  });

  it('shows one main line per table column: the most balanced open total', () => {
    const markets = tableMarkets(
      event([market('m1', 2), total(1.5, 1.3, 3.4), total(2.5, 1.95, 1.85), total(3.5, 3.1, 1.35)]),
    );
    expect(markets.map((m) => m.id)).toEqual(['m1', 't2.5']);
  });

  it('filters the overview by Tbilisi day, start soon and competitions', () => {
    const store = new SportsbookStore();
    // 2026-11-01 12:00 in Tbilisi.
    const now = Date.UTC(2026, 10, 1, 8);
    const at = (
      id: string,
      hoursFromNow: number,
      competition = 'c',
      status: EventDetail['status'] = 'scheduled',
    ) =>
      store.upsert({
        ...event([market(`${id}m`, 2)], status),
        id,
        competition: { id: competition, name: competition, country: 'X', sport: 'football' },
        startsAt: new Date(now + hoursFromNow * 3_600_000).toISOString(),
      });
    at('live', -0.5, 'c', 'live');
    at('soon', 0.5);
    at('tonight', 10); // 22:00 today
    at('tomorrow', 14, 'other'); // 02:00 tomorrow

    expect(ids(store.overview('football', { day: 'today' }, now))).toEqual({
      live: ['live'],
      upcoming: ['soon', 'tonight'],
    });
    expect(ids(store.overview('football', { day: 'tomorrow' }, now))).toEqual({
      live: [],
      upcoming: ['tomorrow'],
    });
    expect(ids(store.overview('football', { day: 'soon' }, now)).upcoming).toEqual(['soon']);
    expect(ids(store.overview('football', { competitions: ['other'] }, now))).toEqual({
      live: [],
      upcoming: ['tomorrow'],
    });
    expect(store.competitions('football', now)).toEqual([
      expect.objectContaining({
        competition: expect.objectContaining({ id: 'c' }),
        liveCount: 1,
        upcomingCount: 2,
      }),
      expect.objectContaining({
        competition: expect.objectContaining({ id: 'other' }),
        liveCount: 0,
        upcomingCount: 1,
      }),
    ]);
  });
});
