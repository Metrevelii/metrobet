import { crashPointFromUniform, crashElapsedFor, crashMultiplierAt } from '@metrobet/contracts';

import { crashPointFor, newSeed, seedHash } from './crash-fairness.js';

describe('crash fairness', () => {
  it('derives the same crash point from the same seed and round (verifiable)', () => {
    const seed = newSeed();
    expect(crashPointFor(seed, 'metro-jet', 7)).toBe(crashPointFor(seed, 'metro-jet', 7));
    expect(seedHash(seed)).toMatch(/^[0-9a-f]{64}$/);
    // Each game has its own sequence: the same seed and number give another point per game.
    const games = Array.from({ length: 20 }, (_, i) => [
      crashPointFor(seed, 'metro-jet', i),
      crashPointFor(seed, 'longshot', i),
    ]);
    expect(games.some(([jet, longshot]) => jet !== longshot)).toBe(true);
  });

  it('pays back about 97 % for any cash-out target', () => {
    const rounds = 40_000;
    const seed = 'fixed-seed-for-a-deterministic-sample';
    const points = Array.from({ length: rounds }, (_, i) =>
      crashPointFor(seed, 'metro-jet', i + 1),
    );
    for (const target of [1.5, 2, 5]) {
      const rtp = (points.filter((point) => point >= target).length * target) / rounds;
      expect(rtp).toBeGreaterThan(0.93);
      expect(rtp).toBeLessThan(1.01);
    }
    // 1.00× = everything below 1.01: P = 1 − 0.97 / 1.01 ≈ 3.96 %.
    const instant = points.filter((point) => point === 1).length / rounds;
    expect(instant).toBeGreaterThan(0.035);
    expect(instant).toBeLessThan(0.045);
  });

  it('maps r to crash points with P(crash ≥ x) = 0.97 / x', () => {
    expect(crashPointFromUniform(0)).toBe(1);
    expect(crashPointFromUniform(0.515)).toBe(2);
    expect(crashPointFromUniform(0.999_999_9)).toBe(1000);
  });

  it('keeps the multiplier curve and its inverse consistent', () => {
    expect(crashMultiplierAt(0)).toBe(1);
    expect(crashMultiplierAt(crashElapsedFor(2) + 1)).toBe(2);
    expect(crashMultiplierAt(-50)).toBe(1);
  });
});
