import type { LiveState, Market, Score } from '@metrobet/contracts';

import { buildMarket, drift, normalCdf, withDrift } from './pricing.js';
import { normalSample, type Rng } from './rng.js';
import type { MatchModel, MatchState } from './match-model.js';

const MINUTE = 60_000;
const QUARTER = 12;
/** Real-time start minute of each quarter (2-min breaks, 10-min half-time). */
const QUARTER_STARTS = [0, 14, 36, 50];
const FULL_TIME = 62;
/** Per-team scoring noise per minute; gives a final-margin SD of ~13 points, like real games. */
const SD_PER_MINUTE = 1.35;

const roundHalf = (value: number) => Math.round(value - 0.5) + 0.5;

export function createBasketballMatch(
  rng: Rng,
  homeRating: number,
  awayRating: number,
): MatchModel {
  const rateHome = 2.3 + (homeRating - awayRating) / 120 + 0.05;
  const rateAway = 2.3 + (awayRating - homeRating) / 120;
  const perMinute = Array.from({ length: QUARTER * 4 }, () => ({
    home: Math.max(0, Math.round(rateHome + normalSample(rng) * SD_PER_MINUTE)),
    away: Math.max(0, Math.round(rateAway + normalSample(rng) * SD_PER_MINUTE)),
  }));
  // No overtime in the simulation: settle a tie in the last minute.
  const totals = perMinute.reduce(
    (sum, m) => ({ home: sum.home + m.home, away: sum.away + m.away }),
    { home: 0, away: 0 },
  );
  if (totals.home === totals.away)
    perMinute[perMinute.length - 1]![homeRating >= awayRating ? 'home' : 'away'] += 1;

  const scoreAt = (gameMinute: number): Score =>
    perMinute
      .slice(0, Math.floor(gameMinute))
      .reduce((sum, m) => ({ home: sum.home + m.home, away: sum.away + m.away }), {
        home: 0,
        away: 0,
      });

  const meanDiff = (rateHome - rateAway) * 48;
  const spreadLine = -roundHalf(meanDiff);
  const totalLine = roundHalf((rateHome + rateAway) * 48);

  return {
    durationMs: FULL_TIME * MINUTE,
    stateAt(eventId, elapsedMs, now): MatchState {
      const elapsed = elapsedMs / MINUTE;
      const started = elapsed >= 0;
      const ended = elapsed >= FULL_TIME;
      const quarterIndex = QUARTER_STARTS.findLastIndex((start) => elapsed >= start);
      const inQuarter = quarterIndex >= 0 ? elapsed - QUARTER_STARTS[quarterIndex]! : 0;
      const onBreak = started && !ended && inQuarter >= QUARTER;
      const gameMinute = ended
        ? 48
        : !started
          ? 0
          : quarterIndex * QUARTER + Math.min(QUARTER, inQuarter);
      const score = scoreAt(gameMinute);

      let live: LiveState | null = null;
      if (started) {
        const left = Math.max(0, QUARTER - inQuarter) * 60;
        const quarters = Array.from({ length: Math.min(4, quarterIndex + 1) }, (_, q) => {
          const end = scoreAt(Math.min(gameMinute, (q + 1) * QUARTER));
          const start = scoreAt(q * QUARTER);
          return { home: end.home - start.home, away: end.away - start.away };
        });
        live = {
          period: ended
            ? 'FT'
            : onBreak
              ? quarterIndex === 1
                ? 'HT'
                : 'BREAK'
              : `Q${quarterIndex + 1}`,
          clock:
            ended || onBreak
              ? null
              : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`,
          score,
          periodScores: quarters,
        };
      }

      const remaining = 48 - gameMinute;
      const expectedDiff = score.home - score.away + (rateHome - rateAway) * remaining;
      const expectedTotal = score.home + score.away + (rateHome + rateAway) * remaining;
      const sd = Math.max(0.5, SD_PER_MINUTE * Math.sqrt(2 * remaining));
      const factor = drift(eventId, started ? Math.floor(now / 20_000) : Math.floor(now / 600_000));
      const status = ended ? 'closed' : 'open';

      const [home, away] = withDrift(
        [normalCdf(expectedDiff / sd), 1 - normalCdf(expectedDiff / sd)],
        factor,
      ) as [number, number];
      const cover = normalCdf((expectedDiff + spreadLine) / sd);
      const over = normalCdf((expectedTotal - totalLine) / sd);

      const markets: Market[] = [
        buildMarket({
          eventId,
          type: 'moneyline',
          status,
          outcomes: [
            ['home', home],
            ['away', away],
          ],
        }),
        buildMarket({
          eventId,
          type: 'spread',
          line: spreadLine,
          status,
          outcomes: [
            ['home', cover],
            ['away', 1 - cover],
          ],
        }),
        buildMarket({
          eventId,
          type: 'total',
          line: totalLine,
          status,
          outcomes: [
            ['over', over],
            ['under', 1 - over],
          ],
        }),
      ];
      return { status: ended ? 'ended' : started ? 'live' : 'scheduled', live, markets };
    },
  };
}
