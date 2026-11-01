import {
  CORRECT_SCORE_MAX,
  type LiveState,
  type Market,
  type MarketStatus,
  type Score,
  type SelectionKey,
} from '@metrobet/contracts';

import { buildMarket, drift, finalScoreDistribution, probabilityOf, withDrift } from './pricing.js';
import { type Rng, poissonSample } from './rng.js';
import type { MatchModel, MatchState } from './match-model.js';

const MINUTE = 60_000;
const TOTAL_LINES = [1.5, 2.5, 3.5];
const TEAM_TOTAL_LINES = [0.5, 1.5];
const HANDICAP_LINES = [-1.5, 1.5];

/**
 * Real-time schedule of a football-like match, in real minutes since kick-off. The match itself
 * always has 90 match minutes (45 per half); the schedule says how long they take in real time.
 */
export type FootballSchedule = {
  /** Real minutes of the first half, and when the second half starts and ends. */
  half: number;
  secondHalfStart: number;
  fullTime: number;
  /** Bet stop after a goal, in match minutes. */
  goalSuspension: number;
  /** Scales expected goals (eSoccer matches score more). */
  goalsFactor: number;
};

/** Real football: 1H 0–45, HT 45–60, 2H 60–105 real minutes; 30 s bet stop after goals. */
export const FOOTBALL_SCHEDULE: FootballSchedule = {
  half: 45,
  secondHalfStart: 60,
  fullTime: 105,
  goalSuspension: 0.5,
  goalsFactor: 1,
};

/** eSoccer: 2 × 4 real minutes with a 1-minute break, more goals, ~16 s bet stop after goals. */
export const ESOCCER_SCHEDULE: FootballSchedule = {
  half: 4,
  secondHalfStart: 5,
  fullTime: 9,
  goalSuspension: 3,
  goalsFactor: 1.45,
};

type Goal = { minute: number; team: 'home' | 'away' };
const outcome = (s: Score) => (s.home > s.away ? 'home' : s.home < s.away ? 'away' : 'draw');

export function createFootballMatch(
  rng: Rng,
  homeRating: number,
  awayRating: number,
  schedule: FootballSchedule = FOOTBALL_SCHEDULE,
): MatchModel {
  const lambdaHome = (1.25 * Math.exp((homeRating - awayRating) / 28) + 0.2) * schedule.goalsFactor;
  const lambdaAway = 1.05 * Math.exp((awayRating - homeRating) / 28) * schedule.goalsFactor;
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

  /** Match minute (0–90) at `elapsed` real minutes, and the period. */
  const clockAt = (elapsed: number) => {
    if (elapsed < schedule.half) return { minute: (elapsed / schedule.half) * 45, period: '1H' };
    if (elapsed < schedule.secondHalfStart) return { minute: 45, period: 'HT' };
    if (elapsed < schedule.fullTime) {
      const second =
        (elapsed - schedule.secondHalfStart) / (schedule.fullTime - schedule.secondHalfStart);
      return { minute: 45 + second * 45, period: '2H' };
    }
    return { minute: 90, period: 'FT' };
  };

  return {
    durationMs: schedule.fullTime * MINUTE,
    stateAt(eventId, elapsedMs, now): MatchState {
      const elapsed = elapsedMs / MINUTE;
      const started = elapsed >= 0;
      const ended = elapsed >= schedule.fullTime;
      const { minute, period } = started ? clockAt(elapsed) : { minute: 0, period: '1H' };
      const score = scoreAt(minute);
      const firstHalf = scoreAt(Math.min(minute, 45));

      let live: LiveState | null = null;
      if (started) {
        live = {
          period,
          clock: period === '1H' || period === '2H' ? `${Math.floor(minute) + 1}'` : null,
          score,
          periodScores:
            minute < 45
              ? [score]
              : [
                  firstHalf,
                  { home: score.home - firstHalf.home, away: score.away - firstHalf.away },
                ],
        };
      }

      const lastGoal = goals.filter((g) => g.minute <= minute).at(-1);
      const suspended =
        started &&
        !ended &&
        lastGoal !== undefined &&
        minute - lastGoal.minute < schedule.goalSuspension;
      const remaining = Math.max(0, (90 - minute) / 90);
      const dist = finalScoreDistribution(score, lambdaHome * remaining, lambdaAway * remaining);
      // First-half goals still expected (none once the first half is over).
      const firstHalfLeft = Math.max(0, (45 - minute) / 90);
      const htDist = finalScoreDistribution(
        firstHalf,
        lambdaHome * firstHalfLeft,
        lambdaAway * firstHalfLeft,
      );
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
      const overUnder = (
        line: number,
        goalsOf: (s: Score) => number,
        decided: number,
      ): { status: MarketStatus; outcomes: [SelectionKey, number][] } => ({
        status: decided > line ? ('closed' as const) : status,
        outcomes: [
          ['over', probabilityOf(dist, (s) => goalsOf(s) > line)],
          ['under', probabilityOf(dist, (s) => goalsOf(s) < line)],
        ] as [SelectionKey, number][],
      });

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
        ...TOTAL_LINES.map((line) =>
          buildMarket({
            eventId,
            type: 'total',
            line,
            ...overUnder(line, (s) => s.home + s.away, goalsSoFar),
          }),
        ),
        buildMarket({
          eventId,
          type: 'btts',
          status: score.home > 0 && score.away > 0 ? 'closed' : status,
          outcomes: [
            ['yes', btts],
            ['no', 1 - btts],
          ],
        }),
        // Decided at half-time: closed from then on.
        buildMarket({
          eventId,
          type: 'ht_1x2',
          status: minute >= 45 ? 'closed' : status,
          outcomes: (['home', 'draw', 'away'] as const).map((key) => [
            key,
            probabilityOf(htDist, (s) => outcome(s) === key),
          ]),
        }),
        ...HANDICAP_LINES.map((line) =>
          buildMarket({
            eventId,
            type: 'spread',
            line,
            status,
            outcomes: [
              ['home', probabilityOf(dist, (s) => s.home + line > s.away)],
              ['away', probabilityOf(dist, (s) => s.home + line < s.away)],
            ],
          }),
        ),
        ...TEAM_TOTAL_LINES.flatMap((line) => [
          buildMarket({
            eventId,
            type: 'team_total_home',
            line,
            ...overUnder(line, (s) => s.home, score.home),
          }),
          buildMarket({
            eventId,
            type: 'team_total_away',
            line,
            ...overUnder(line, (s) => s.away, score.away),
          }),
        ]),
        buildMarket({
          eventId,
          type: 'correct_score',
          status,
          outcomes: correctScoreOutcomes(dist),
        }),
      ];

      return { status: ended ? 'ended' : started ? 'live' : 'scheduled', live, markets };
    },
  };
}

/** Probabilities of 0–0 … 3–3 and of any other score. */
function correctScoreOutcomes(dist: ReturnType<typeof finalScoreDistribution>) {
  const grid: [SelectionKey, number][] = [];
  for (let home = 0; home <= CORRECT_SCORE_MAX; home += 1) {
    for (let away = 0; away <= CORRECT_SCORE_MAX; away += 1) {
      grid.push([
        `cs_${home}_${away}` as SelectionKey,
        probabilityOf(dist, (s) => s.home === home && s.away === away),
      ]);
    }
  }
  const covered = grid.reduce((sum, [, p]) => sum + p, 0);
  return [...grid, ['cs_other', Math.max(0, 1 - covered)] as [SelectionKey, number]];
}

/** eSoccer: the football model on a short schedule. */
export const createESoccerMatch = (rng: Rng, homeRating: number, awayRating: number) =>
  createFootballMatch(rng, homeRating, awayRating, ESOCCER_SCHEDULE);
