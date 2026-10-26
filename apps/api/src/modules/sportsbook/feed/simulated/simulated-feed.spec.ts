import type { EventDetail } from '@metrobet/contracts';

import { eventAt, fixturesForSlot, SLOT_MS } from './simulated-feed.js';

const MINUTE = 60_000;

describe('simulated feed', () => {
  it('is deterministic: the same slot always yields the same fixtures and scores', () => {
    const a = fixturesForSlot(123_456);
    const b = fixturesForSlot(123_456);
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
    const at = 123_456 * SLOT_MS + 70 * MINUTE;
    expect(a.map((f) => eventAt(f, at)?.live)).toEqual(b.map((f) => eventAt(f, at)?.live));
  });

  it('plays a match from scheduled through live to ended, then drops it', () => {
    const slot = 500_000;
    const fixture =
      fixturesForSlot(slot).find((f) => f.sport === 'football') ?? fixturesForSlot(slot)[0]!;
    const start = Date.parse(fixture.startsAt);

    expect(eventAt(fixture, start - MINUTE)?.status).toBe('scheduled');
    expect(eventAt(fixture, start - MINUTE)?.live).toBeNull();

    let lastTotal = 0;
    for (let t = 0; t < fixture.model.durationMs; t += MINUTE) {
      const event = eventAt(fixture, start + t) as EventDetail;
      expect(event.status).toBe('live');
      const total = event.live!.score.home + event.live!.score.away;
      expect(total).toBeGreaterThanOrEqual(lastTotal);
      lastTotal = total;
      for (const market of event.markets) {
        for (const selection of market.selections)
          expect(selection.odds).toBeGreaterThanOrEqual(1.01);
      }
    }

    const ended = eventAt(fixture, start + fixture.model.durationMs + 1) as EventDetail;
    expect(ended.status).toBe('ended');
    expect(ended.live?.period).toBe('FT');
    expect(ended.markets.every((m) => m.status === 'closed')).toBe(true);
    expect(eventAt(fixture, start + fixture.model.durationMs + 60 * MINUTE)).toBeNull();
  });

  it('every market of a scheduled event is open with a sensible overround', () => {
    for (const fixture of fixturesForSlot(42)) {
      const event = eventAt(fixture, Date.parse(fixture.startsAt) - 10 * MINUTE)!;
      for (const market of event.markets.filter((m) => m.type !== 'double_chance')) {
        expect(market.status).toBe('open');
        const overround = market.selections.reduce((sum, s) => sum + 1 / s.odds, 0);
        expect(overround).toBeGreaterThan(1);
        expect(overround).toBeLessThan(1.15);
      }
    }
  });
});

describe('simulated schedule', () => {
  it('never schedules a team in two overlapping matches', () => {
    const fixtures = Array.from({ length: 200 }, (_, i) => fixturesForSlot(700_000 + i)).flat();
    const byTeam = new Map<string, { start: number; end: number }[]>();
    for (const fixture of fixtures) {
      const start = Date.parse(fixture.startsAt);
      const span = { start, end: start + fixture.model.durationMs };
      for (const team of [fixture.home.name, fixture.away.name]) {
        const key = `${fixture.competition.id}:${team}`;
        const spans = byTeam.get(key) ?? [];
        expect(spans.some((s) => s.start < span.end && span.start < s.end)).toBe(false);
        spans.push(span);
        byTeam.set(key, spans);
      }
    }
  });
});
