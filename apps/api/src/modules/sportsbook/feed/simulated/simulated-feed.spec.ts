import type { EventDetail } from '@metrobet/contracts';

import { eventAt, fixturesForSlot, SimulatedOddsFeed, SLOT_MS } from './simulated-feed.js';

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

  it('answers the final result of any finished match from its id alone', async () => {
    const feed = new SimulatedOddsFeed();
    for (const fixture of fixturesForSlot(777_000)) {
      const end = Date.parse(fixture.startsAt) + fixture.model.durationMs;
      expect(await feed.result(fixture.id, end - MINUTE)).toBeNull();
      // Long after the match left the lists, the result is still there and matches the feed.
      const result = await feed.result(fixture.id, end + 24 * 60 * MINUTE);
      expect(result).toEqual({
        eventId: fixture.id,
        sport: fixture.sport,
        final: (eventAt(fixture, end + 1) as EventDetail).live,
      });
      expect(result?.final.period).toBe('FT');
    }
    expect(await feed.result('not-a-sim-event')).toBeNull();
  });

  it('plays eSoccer all day with football markets on a 9-minute schedule', () => {
    const slots = Array.from({ length: 4 }, (_, i) => 900_000 + i);
    const esoccer = slots
      .flatMap((slot) => fixturesForSlot(slot))
      .filter((f) => f.sport === 'esoccer');
    expect(esoccer.length).toBeGreaterThanOrEqual(4 * 6); // two leagues × 3 matches every slot
    const fixture = esoccer[0]!;
    expect(fixture.model.durationMs).toBe(9 * MINUTE);
    const live = eventAt(fixture, Date.parse(fixture.startsAt) + 2 * MINUTE) as EventDetail;
    expect(live.status).toBe('live');
    expect(live.live?.period).toBe('1H');
    const types = new Set(live.markets.map((market) => market.type));
    for (const type of [
      '1x2',
      'ht_1x2',
      'correct_score',
      'team_total_home',
      'team_total_away',
      'spread',
    ]) {
      expect(types).toContain(type);
    }
  });

  it('prices a correct-score grid whose probabilities cover every score', () => {
    // Football plays a round every 8 slots: look through a few.
    const fixture = Array.from({ length: 8 }, (_, i) => fixturesForSlot(500_000 + i))
      .flat()
      .find((f) => f.sport === 'football')!;
    const event = eventAt(fixture, Date.parse(fixture.startsAt) - MINUTE) as EventDetail;
    const market = event.markets.find((item) => item.type === 'correct_score')!;
    expect(market.selections).toHaveLength(17);
    // Implied probabilities include the 6 % margin (prices are rounded, so allow some slack).
    const implied = market.selections.reduce((sum, selection) => sum + 1 / selection.odds, 0);
    expect(implied).toBeGreaterThan(0.95);
    expect(implied).toBeLessThan(1.25);
  });
});
