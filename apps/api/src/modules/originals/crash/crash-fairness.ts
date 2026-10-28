import { createHash, createHmac, randomBytes } from 'node:crypto';

import { type CrashGame, crashPointFromUniform } from '@metrobet/contracts';

const TWO_POW_52 = 2 ** 52;

export const newSeed = () => randomBytes(32).toString('hex');
export const seedHash = (seed: string) => createHash('sha256').update(seed).digest('hex');

/**
 * Provably fair crash point: the first 52 bits of HMAC-SHA256(seed, "<game>:<round>") as a
 * uniform r in [0, 1), then `crashPointFromUniform(r)`. Anyone can recompute it once the seed is
 * revealed and check it against the hash published before the round.
 */
export function crashPointFor(seed: string, game: CrashGame, roundNumber: number): number {
  const digest = createHmac('sha256', seed).update(`${game}:${roundNumber}`).digest('hex');
  const r = Number.parseInt(digest.slice(0, 13), 16) / TWO_POW_52;
  return crashPointFromUniform(r);
}
