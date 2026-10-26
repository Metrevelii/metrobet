/** Deterministic randomness: the same seed always produces the same match. */
export type Rng = () => number;

export function seedFrom(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const char of parts.join('|')) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** mulberry32: tiny, fast, good enough for simulations. */
export function createRng(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]!;

export function poissonSample(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

/** Standard normal sample (Box–Muller). */
export function normalSample(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}
