import { createHash, createHmac, randomBytes } from 'node:crypto';

import { jetCrashPoint } from '@metrobet/contracts';

const TWO_POW_52 = 2 ** 52;

export const newSeed = () => randomBytes(32).toString('hex');
export const seedHash = (seed: string) => createHash('sha256').update(seed).digest('hex');

/**
 * Provably fair crash point: the first 52 bits of HMAC-SHA256(seed, "metro-jet:<round>") as a
 * uniform r in [0, 1), then `jetCrashPoint(r)`. Anyone can recompute it once the seed is revealed
 * and check it against the hash published before the round.
 */
export function crashPointFor(seed: string, roundNumber: number): number {
  const digest = createHmac('sha256', seed).update(`metro-jet:${roundNumber}`).digest('hex');
  const r = Number.parseInt(digest.slice(0, 13), 16) / TWO_POW_52;
  return jetCrashPoint(r);
}
