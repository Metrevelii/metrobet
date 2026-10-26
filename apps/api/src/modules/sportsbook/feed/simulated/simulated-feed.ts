import type { EventDetail, Sport } from '@metrobet/contracts';
import { Injectable, Logger } from '@nestjs/common';

import { type FeedHandler, OddsFeed } from '../odds-feed.js';
import { createBasketballMatch } from './basketball.js';
import { COMPETITIONS, type SimCompetition } from './catalog.js';
import { createFootballMatch } from './football.js';
import type { MatchModel } from './match-model.js';
import { createRng, seedFrom } from './rng.js';
import { createTennisMatch } from './tennis.js';

const MINUTE = 60_000;
/** Fixtures start on 15-minute slots. */
export const SLOT_MS = 15 * MINUTE;
/** Look back far enough to cover the longest match plus the time results stay listed. */
const LOOKBACK_SLOTS = 16;
const HORIZON_SLOTS = (48 * 60) / 15;
/** Finished matches stay visible (with the final score) for a while. */
const ENDED_LINGER_MS = 10 * MINUTE;
const TICK_MS = 2_000;

const MODELS: Record<Sport, typeof createFootballMatch> = {
  football: createFootballMatch,
  basketball: createBasketballMatch,
  tennis: createTennisMatch,
};

type Fixture = Omit<EventDetail, 'status' | 'live' | 'markets'> & { model: MatchModel };

function shuffled<T>(rng: () => number, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * The fixtures starting in one slot. Pure: the same slot always yields the same matches.
 * Each competition plays a round when the slot hits its cadence (offset by its index).
 */
export function fixturesForSlot(slot: number): Fixture[] {
  return COMPETITIONS.flatMap((competition: SimCompetition, index) => {
    if ((slot + index) % competition.cadenceSlots !== 0) return [];
    const { teams, cadenceSlots: _cadence, matchesPerRound, ...publicCompetition } = competition;
    const rng = createRng(seedFrom('round', competition.id, slot));
    const players = shuffled(rng, teams);
    return Array.from({ length: matchesPerRound }, (_, match) => {
      const home = players[match * 2]!;
      const away = players[match * 2 + 1]!;
      const id = `sim-${slot}-${competition.id}-${match}`;
      return {
        id,
        sport: competition.sport,
        competition: publicCompetition,
        home: { name: home[0], abbreviation: home[1] },
        away: { name: away[0], abbreviation: away[1] },
        startsAt: new Date(slot * SLOT_MS).toISOString(),
        model: MODELS[competition.sport](createRng(seedFrom(id)), home[2], away[2]),
      };
    });
  });
}

/** Full event state at `now`, or null once a finished match has stopped lingering. */
export function eventAt(fixture: Fixture, now: number): EventDetail | null {
  const elapsed = now - Date.parse(fixture.startsAt);
  if (elapsed > fixture.model.durationMs + ENDED_LINGER_MS) return null;
  const { model, ...event } = fixture;
  return { ...event, ...model.stateAt(fixture.id, elapsed, now) };
}

/**
 * Deterministic simulated feed: rolling fixtures for the next 48 h, live matches played out in
 * real time (goals, bet stops, price drift). State is a pure function of time, so restarts and
 * multiple API instances agree.
 */
@Injectable()
export class SimulatedOddsFeed extends OddsFeed {
  private readonly logger = new Logger(SimulatedOddsFeed.name);
  private readonly fixtures = new Map<string, Fixture>();
  private readonly loadedSlots = new Set<number>();
  private timer: ReturnType<typeof setInterval> | undefined;

  start(handler: FeedHandler) {
    const tick = () => this.tick(handler, Date.now());
    tick();
    this.timer = setInterval(tick, TICK_MS);
    this.timer.unref();
    this.logger.log(`Simulated feed started (${this.fixtures.size} fixtures)`);
  }

  stop() {
    clearInterval(this.timer);
  }

  tick(handler: FeedHandler, now: number) {
    const current = Math.floor(now / SLOT_MS);
    for (let slot = current - LOOKBACK_SLOTS; slot <= current + HORIZON_SLOTS; slot += 1) {
      if (this.loadedSlots.has(slot)) continue;
      this.loadedSlots.add(slot);
      for (const fixture of fixturesForSlot(slot)) this.fixtures.set(fixture.id, fixture);
    }
    for (const slot of this.loadedSlots)
      if (slot < current - LOOKBACK_SLOTS) this.loadedSlots.delete(slot);
    for (const [id, fixture] of this.fixtures) {
      const event = eventAt(fixture, now);
      if (event) {
        handler.upsert(event);
      } else {
        this.fixtures.delete(id);
        handler.remove(id);
      }
    }
  }
}
