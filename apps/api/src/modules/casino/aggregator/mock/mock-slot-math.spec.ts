import { SLOT_SYMBOLS, slotMultiplier, slotRtp, spinSlot } from './mock-slot-math.js';

describe('mock slot math', () => {
  it('returns about 95.4 % to the player over all combinations', () => {
    expect(slotRtp()).toBeCloseTo(0.9537, 3);
  });

  it('pays triples by symbol, pairs of neighbours, and nothing else', () => {
    expect(slotMultiplier([5, 5, 5])).toBe(30);
    expect(slotMultiplier([0, 0, 0])).toBe(5);
    expect(slotMultiplier([1, 1, 3])).toBe(2);
    expect(slotMultiplier([3, 1, 1])).toBe(2);
    expect(slotMultiplier([1, 3, 1])).toBe(0);
  });

  it('spins three valid reels and reports their multiplier', () => {
    for (let i = 0; i < 100; i++) {
      const { reels, multiplier } = spinSlot();
      expect(reels).toHaveLength(3);
      for (const reel of reels) expect(reel).toBeLessThan(SLOT_SYMBOLS.length);
      expect(multiplier).toBe(slotMultiplier(reels));
    }
  });
});
