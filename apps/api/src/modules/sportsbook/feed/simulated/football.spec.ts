import type { LiveState, MatchStats } from '@metrobet/contracts';

import { createFootballMatch } from './football.js';
import { createRng } from './rng.js';

const MINUTE = 60_000;
const COUNTED: (keyof MatchStats)[] = [
  'shots',
  'shotsOnTarget',
  'corners',
  'yellowCards',
  'redCards',
];

const liveAt = (seed: number, realMinute: number) =>
  createFootballMatch(createRng(seed), 80, 74).stateAt('e1', realMinute * MINUTE, 0).live!;

describe('football match tracker', () => {
  it('is deterministic for a seed', () => {
    expect(liveAt(42, 70)).toEqual(liveAt(42, 70));
  });

  it('only ever adds stats and incidents as the match goes on', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let previous: LiveState | null = null;
      for (let minute = 0; minute <= 105; minute += 1) {
        const live = liveAt(seed, minute);
        const { stats, incidents = [] } = live;
        expect(stats).toBeDefined();
        expect(stats!.possession.home + stats!.possession.away).toBe(100);
        // Goals in the incident list are the score; shots on target include every goal.
        const goals = incidents.filter((i) => i.type === 'goal');
        expect(goals.filter((g) => g.team === 'home')).toHaveLength(live.score.home);
        expect(goals.filter((g) => g.team === 'away')).toHaveLength(live.score.away);
        expect(stats!.shotsOnTarget.home).toBeGreaterThanOrEqual(live.score.home);
        expect(stats!.shots.home).toBeGreaterThanOrEqual(stats!.shotsOnTarget.home);
        expect(incidents.map((i) => i.minute)).toEqual(
          incidents.map((i) => i.minute).toSorted((a, b) => a - b),
        );
        if (previous) {
          for (const key of COUNTED) {
            expect(stats![key].home).toBeGreaterThanOrEqual(previous.stats![key].home);
            expect(stats![key].away).toBeGreaterThanOrEqual(previous.stats![key].away);
          }
          expect(incidents.length).toBeGreaterThanOrEqual(previous.incidents!.length);
        }
        previous = live;
      }
    }
  });
});
