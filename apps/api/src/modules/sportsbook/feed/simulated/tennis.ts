import type { LiveState, Market, Score } from '@metrobet/contracts';

import {
  buildMarket,
  drift,
  matchWinProbability,
  setWinProbability,
  withDrift,
} from './pricing.js';
import type { Rng } from './rng.js';
import type { MatchModel, MatchState } from './match-model.js';

const MINUTE = 60_000;

type Game = { winner: 'home' | 'away'; endsAt: number };

const isSetDecided = ({ home, away }: Score) =>
  (home >= 6 && home - away >= 2) || (away >= 6 && away - home >= 2) || home === 7 || away === 7;

/** Plays out a best-of-3 match game by game (tiebreak at 6–6 counts as one game). */
export function createTennisMatch(rng: Rng, homeRating: number, awayRating: number): MatchModel {
  const pGame = Math.min(0.8, Math.max(0.2, 0.5 + (homeRating - awayRating) / 150));
  const games: Game[] = [];
  const sets = { home: 0, away: 0 };
  let set = { home: 0, away: 0 };
  let clock = 0;

  while (sets.home < 2 && sets.away < 2) {
    clock += 3 + rng() * 2;
    const winner = rng() < pGame ? 'home' : 'away';
    games.push({ winner, endsAt: clock });
    set = { ...set, [winner]: set[winner] + 1 };
    if (isSetDecided(set)) {
      sets[set.home > set.away ? 'home' : 'away'] += 1;
      set = { home: 0, away: 0 };
      clock += 2;
    }
  }
  const durationMinutes = clock;

  /** Sets won, games in each set, and the current set's games after `minute`. */
  function scoreAt(minute: number) {
    const done = { home: 0, away: 0 };
    const setScores: Score[] = [{ home: 0, away: 0 }];
    for (const game of games) {
      if (game.endsAt > minute) break;
      const current = setScores.at(-1)!;
      current[game.winner] += 1;
      if (isSetDecided(current)) {
        done[current.home > current.away ? 'home' : 'away'] += 1;
        if (done.home < 2 && done.away < 2) setScores.push({ home: 0, away: 0 });
      }
    }
    return { sets: done, setScores, current: setScores.at(-1)! };
  }

  return {
    durationMs: durationMinutes * MINUTE,
    stateAt(eventId, elapsedMs, now): MatchState {
      const elapsed = elapsedMs / MINUTE;
      const started = elapsed >= 0;
      const ended = elapsed >= durationMinutes;
      const { sets: setsWon, setScores, current } = scoreAt(Math.max(0, elapsed));

      const live: LiveState | null = started
        ? {
            period: ended ? 'FT' : `S${setScores.length}`,
            clock: null,
            score: setsWon,
            periodScores: setScores,
          }
        : null;

      const factor = drift(eventId, started ? Math.floor(now / 20_000) : Math.floor(now / 600_000));
      const status = ended ? 'closed' : 'open';
      const [home, away] = withDrift(
        [
          matchWinProbability(pGame, setsWon, current),
          1 - matchWinProbability(pGame, setsWon, current),
        ],
        factor,
      ) as [number, number];
      const setHome = setWinProbability(pGame, current.home, current.away);

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
          type: 'set_winner',
          line: setScores.length,
          status,
          outcomes: [
            ['home', setHome],
            ['away', 1 - setHome],
          ],
        }),
      ];
      return { status: ended ? 'ended' : started ? 'live' : 'scheduled', live, markets };
    },
  };
}
