import type { LiveState, Market, Score } from '@metrobet/contracts';

import { buildMarket, drift, finalScoreDistribution, probabilityOf, withDrift } from './pricing.js';
import { type Rng, poissonSample } from './rng.js';
import type { MatchModel, MatchState } from './match-model.js';

const MINUTE = 60_000;
/** Real-time schedule (minutes since kick-off): 1H 0–45, HT 45–60, 2H 60–105. */
const HALF = 45;
const HT_END = 60;
const FULL_TIME = 105;
/** Bet stop after a goal, in match minutes. */
const GOAL_SUSPENSION = 0.5;
const TOTAL_LINES = [1.5, 2.5, 3.5];

type Goal = { minute: number; team: 'home' | 'away' };

export function createFootballMatch(rng: Rng, homeRating: number, awayRating: number): MatchModel {
  const lambdaHome = 1.25 * Math.exp((homeRating - awayRating) / 28) + 0.2;
  const lambdaAway = 1.05 * Math.exp((awayRating - homeRating) / 28);
  const goals: Goal[] = [
    ...Array.from({ length: poissonSample(rng, lambdaHome) }, () => ({
      minute: 1 + rng() * 89,
      team: 'home' as const,
    })),
    ...Array.from({ length: poissonSample(rng, lambdaAway) }, () => ({
      minute: 1 + rng() * 89,
      team: 'away' as const,
    })),
  ].toSorted((a, b) => a.minute - b.minute);

  const scoreAt = (minute: number): Score => ({
    home: goals.filter((g) => g.minute <= minute && g.team === 'home').length,
    away: goals.filter((g) => g.minute <= minute && g.team === 'away').length,
  });

  return {
    durationMs: FULL_TIME * MINUTE,
    stateAt(eventId, elapsedMs, now): MatchState {
      const elapsed = elapsedMs / MINUTE;
      const started = elapsed >= 0;
      const ended = elapsed >= FULL_TIME;
      const minute = !started
        ? 0
        : elapsed < HALF
          ? elapsed
          : elapsed < HT_END
            ? HALF
            : Math.min(90, elapsed - (HT_END - HALF));
      const score = scoreAt(minute);

      let live: LiveState | null = null;
      if (started) {
        const firstHalf = scoreAt(HALF);
        const period = ended ? 'FT' : elapsed < HALF ? '1H' : elapsed < HT_END ? 'HT' : '2H';
        live = {
          period,
          clock: period === '1H' || period === '2H' ? `${Math.floor(minute) + 1}'` : null,
          score,
          periodScores:
            elapsed < HALF
              ? [score]
              : [
                  firstHalf,
                  { home: score.home - firstHalf.home, away: score.away - firstHalf.away },
                ],
        };
      }

      const lastGoal = goals.filter((g) => g.minute <= minute).at(-1);
      const suspended =
        started && !ended && lastGoal !== undefined && minute - lastGoal.minute < GOAL_SUSPENSION;
      const remaining = Math.max(0, (90 - minute) / 90);
      const dist = finalScoreDistribution(score, lambdaHome * remaining, lambdaAway * remaining);
      // Live prices move every 20 s, pre-match every 10 min.
      const factor = drift(eventId, started ? Math.floor(now / 20_000) : Math.floor(now / 600_000));
      const status = ended ? 'closed' : suspended ? 'suspended' : 'open';

      const [home, draw, away] = withDrift(
        [
          probabilityOf(dist, (s) => s.home > s.away),
          probabilityOf(dist, (s) => s.home === s.away),
          probabilityOf(dist, (s) => s.home < s.away),
        ],
        factor,
      ) as [number, number, number];
      const goalsSoFar = score.home + score.away;
      const btts = probabilityOf(dist, (s) => s.home > 0 && s.away > 0);

      const markets: Market[] = [
        buildMarket({
          eventId,
          type: '1x2',
          status,
          outcomes: [
            ['home', home],
            ['draw', draw],
            ['away', away],
          ],
        }),
        buildMarket({
          eventId,
          type: 'double_chance',
          status,
          outcomes: [
            ['home_draw', home + draw],
            ['home_away', home + away],
            ['draw_away', draw + away],
          ],
        }),
        ...TOTAL_LINES.map((line) => {
          const over = probabilityOf(dist, (s) => s.home + s.away > line);
          return buildMarket({
            eventId,
            type: 'total',
            line,
            status: goalsSoFar > line ? 'closed' : status,
            outcomes: [
              ['over', over],
              ['under', 1 - over],
            ],
          });
        }),
        buildMarket({
          eventId,
          type: 'btts',
          status: score.home > 0 && score.away > 0 ? 'closed' : status,
          outcomes: [
            ['yes', btts],
            ['no', 1 - btts],
          ],
        }),
      ];

      return { status: ended ? 'ended' : started ? 'live' : 'scheduled', live, markets };
    },
  };
}
