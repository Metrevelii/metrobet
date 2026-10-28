import {
  SUPRA_PAYLINES,
  SUPRA_STRIPS,
  SUPRA_SYMBOLS,
  SUPRA_WILD,
  supraGrid,
  supraLinePay,
  supraWins,
} from '@metrobet/contracts';

import { randomStops } from './supra-fortune.service.js';

/**
 * Exact RTP: each cell of a reel shows a symbol with its strip frequency, and reels are
 * independent, so one line's expected pay (in line bets) is the RTP of the whole game.
 */
function exactRtp(): number {
  const freq = SUPRA_STRIPS.map((strip) => {
    const counts = SUPRA_SYMBOLS.map(() => 0);
    for (const symbol of strip) counts[symbol]!++;
    return counts.map((count) => count / strip.length);
  });
  let rtp = 0;
  const walk = (reel: number, symbols: number[], p: number) => {
    if (reel === SUPRA_STRIPS.length) {
      rtp += p * (supraLinePay(symbols)?.pay ?? 0);
      return;
    }
    freq[reel]!.forEach((q, symbol) => q > 0 && walk(reel + 1, [...symbols, symbol], p * q));
  };
  walk(0, [], 1);
  return rtp;
}

describe('Supra Fortune', () => {
  it('returns 96.27 % to the player', () => {
    expect(exactRtp()).toBeCloseTo(0.9627, 4);
  });

  it('pays the longest left-to-right run, with wilds standing in', () => {
    const W = SUPRA_WILD;
    expect(supraLinePay([0, 0, 0, 1, 2])).toEqual({ symbol: 0, count: 3, pay: 5 });
    expect(supraLinePay([W, 4, 4, 4, 4])).toEqual({ symbol: 4, count: 5, pay: 200 });
    expect(supraLinePay([W, W, W, 0, 1])).toEqual({ symbol: W, count: 3, pay: 50 });
    expect(supraLinePay([W, W, W, 6, 6])).toEqual({ symbol: 6, count: 5, pay: 600 });
    expect(supraLinePay([0, 1, 0, 0, 0])).toBeNull();
  });

  it('scores every payline of a grid in minor units of the total bet', () => {
    const middle = [0, 0, 0, 0, 0].map(() => [3, 2, 1]); // middle row all bread (2)
    const wins = supraWins(middle, 1_00);
    expect(wins).toContainEqual({ line: 0, symbol: 2, count: 5, amount: 8_00 });
    expect(wins.every((win) => win.line < SUPRA_PAYLINES.length)).toBe(true);
  });

  it('draws valid stops and grids', () => {
    const grid = supraGrid(randomStops());
    expect(grid).toHaveLength(5);
    for (const column of grid) {
      expect(column).toHaveLength(3);
      for (const symbol of column) expect(symbol).toBeLessThan(SUPRA_SYMBOLS.length);
    }
  });
});
