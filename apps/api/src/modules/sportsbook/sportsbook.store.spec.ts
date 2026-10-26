import type { EventDetail, EventUpdate, Market } from '@metrobet/contracts';

import { SportsbookStore } from './sportsbook.store.js';

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
});
