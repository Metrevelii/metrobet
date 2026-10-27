import { randomInt } from 'node:crypto';

/** Spins left and what is still to wager for the next one. Amounts are minor units. */
export function wheelProgress(wagered: number, spinsUsed: number, stepAmount: number) {
  return {
    spinsAvailable: Math.max(0, Math.floor(wagered / stepAmount) - spinsUsed),
    toNextSpin: stepAmount - (wagered % stepAmount),
  };
}

/**
 * Index chosen with probability weight / total. `random(n)` returns an integer in [0, n);
 * defaults to a CSPRNG so outcomes can't be predicted.
 */
export function pickWeighted(
  weights: readonly number[],
  random: (max: number) => number = randomInt,
): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random(total);
  for (const [index, weight] of weights.entries()) {
    if (roll < weight) return index;
    roll -= weight;
  }
  throw new Error('pickWeighted: roll out of range');
}
