import type { Market, MarketStatus, MarketType, Score, SelectionKey } from '@metrobet/contracts';

import { createRng, seedFrom } from './rng.js';

/** Bookmaker margin: implied probabilities of a market sum to 1 + MARGIN. */
export const MARGIN = 0.06;
const MIN_ODDS = 1.01;
const MAX_ODDS = 100;
const DECIDED = 0.002;

export function toOdds(probability: number): number {
  const odds = 1 / (probability * (1 + MARGIN));
  return Math.round(Math.min(MAX_ODDS, Math.max(MIN_ODDS, odds)) * 100) / 100;
}

/**
 * Small deterministic price movement so odds "breathe" like a real feed. Same seed + bucket
 * always gives the same factor (0.96–1.04).
 */
export function drift(seed: string, bucket: number): number {
  return 0.96 + createRng(seedFrom(seed, bucket))() * 0.08;
}

/** Applies a drift factor to the first outcome and renormalizes. */
export function withDrift(probabilities: number[], factor: number): number[] {
  const moved = probabilities.map((p, i) => (i === 0 ? p * factor : p));
  const total = moved.reduce((sum, p) => sum + p, 0);
  return moved.map((p) => p / total);
}

export function buildMarket(params: {
  eventId: string;
  type: MarketType;
  line?: number | null;
  status: MarketStatus;
  outcomes: [SelectionKey, number][];
}): Market {
  const line = params.line ?? null;
  const id = `${params.eventId}:${params.type}:${line ?? '-'}`;
  const closed = params.status === 'closed';
  return {
    id,
    type: params.type,
    line,
    status: params.status,
    selections: params.outcomes.map(([key, probability]) => ({
      id: `${id}:${key}`,
      key,
      odds: toOdds(Math.max(probability, DECIDED)),
      active: !closed && probability > DECIDED && probability < 1 - DECIDED,
    })),
  };
}

// ── Football: Poisson goals ─────────────────────────────────────────────────────────────

function poissonPmf(lambda: number, max = 10): number[] {
  const pmf: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= max; k += 1) {
    pmf.push(p);
    p *= lambda / (k + 1);
  }
  return pmf;
}

export type ScoreProbability = { home: number; away: number; p: number };

/** Distribution of the final score, given the current score and goals still expected. */
export function finalScoreDistribution(
  score: Score,
  lambdaHome: number,
  lambdaAway: number,
): ScoreProbability[] {
  const home = poissonPmf(lambdaHome);
  const away = poissonPmf(lambdaAway);
  return home.flatMap((ph, i) =>
    away.map((pa, j) => ({ home: score.home + i, away: score.away + j, p: ph * pa })),
  );
}

export const probabilityOf = (
  distribution: ScoreProbability[],
  predicate: (s: ScoreProbability) => boolean,
) => distribution.reduce((sum, s) => (predicate(s) ? sum + s.p : sum), 0);

// ── Basketball: normal approximation ───────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// ── Tennis: exact recursion over games ─────────────────────────────────────────────────

/** P(player wins the set from games a–b), each game won with probability p; tiebreak at 6–6. */
export function setWinProbability(
  p: number,
  a = 0,
  b = 0,
  memo = new Map<string, number>(),
): number {
  if (a >= 6 && a - b >= 2) return 1;
  if (b >= 6 && b - a >= 2) return 0;
  if (a === 7) return 1;
  if (b === 7) return 0;
  if (a === 6 && b === 6) return p;
  const key = `${a}-${b}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const value =
    p * setWinProbability(p, a + 1, b, memo) + (1 - p) * setWinProbability(p, a, b + 1, memo);
  memo.set(key, value);
  return value;
}

/** P(player wins a best-of-3 match) from the current sets and games. */
export function matchWinProbability(p: number, sets: Score, games: Score): number {
  if (sets.home === 2) return 1;
  if (sets.away === 2) return 0;
  const current = setWinProbability(p, games.home, games.away);
  const fresh = { home: 0, away: 0 };
  return (
    current * matchWinProbability(p, { home: sets.home + 1, away: sets.away }, fresh) +
    (1 - current) * matchWinProbability(p, { home: sets.home, away: sets.away + 1 }, fresh)
  );
}
