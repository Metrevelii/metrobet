import { pickWeighted, wheelProgress } from './wheel-math.js';

describe('wheelProgress', () => {
  const step = 50_00; // 50 ₾

  it('earns one spin per full step', () => {
    expect(wheelProgress(0, 0, step)).toEqual({ spinsAvailable: 0, toNextSpin: 50_00 });
    expect(wheelProgress(49_99, 0, step)).toEqual({ spinsAvailable: 0, toNextSpin: 1 });
    expect(wheelProgress(50_00, 0, step)).toEqual({ spinsAvailable: 1, toNextSpin: 50_00 });
    expect(wheelProgress(123_45, 1, step)).toEqual({ spinsAvailable: 1, toNextSpin: 26_55 });
  });

  it('never goes negative when the step is raised after spins were used', () => {
    expect(wheelProgress(100_00, 2, 100_00).spinsAvailable).toBe(0);
  });
});

describe('pickWeighted', () => {
  it('maps every roll to the segment owning it', () => {
    const weights = [1, 3, 6];
    const picks = Array.from({ length: 10 }, (_, roll) => pickWeighted(weights, () => roll));
    expect(picks).toEqual([0, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
  });

  it('roughly follows the weights with the real RNG', () => {
    const counts = [0, 0];
    for (let i = 0; i < 10_000; i += 1) counts[pickWeighted([1, 9])]! += 1;
    expect(counts[0]).toBeGreaterThan(800);
    expect(counts[0]).toBeLessThan(1200);
  });
});
