import {
  finalScoreDistribution,
  MARGIN,
  matchWinProbability,
  normalCdf,
  probabilityOf,
  setWinProbability,
  toOdds,
} from './pricing.js';

describe('pricing', () => {
  it('applies the margin and clamps odds', () => {
    expect(toOdds(0.5)).toBeCloseTo(1 / (0.5 * (1 + MARGIN)), 2);
    expect(toOdds(0.9999)).toBe(1.01);
    expect(toOdds(0.000001)).toBe(100);
  });

  it('final score distribution is a probability distribution that respects the current score', () => {
    const dist = finalScoreDistribution({ home: 2, away: 1 }, 0.8, 0.6);
    expect(probabilityOf(dist, () => true)).toBeCloseTo(1, 4);
    expect(probabilityOf(dist, (s) => s.home < 2 || s.away < 1)).toBe(0);
    const [home, draw, away] = [
      probabilityOf(dist, (s) => s.home > s.away),
      probabilityOf(dist, (s) => s.home === s.away),
      probabilityOf(dist, (s) => s.home < s.away),
    ];
    expect(home + draw + away).toBeCloseTo(1, 4);
    expect(home).toBeGreaterThan(away);
  });

  it('normal CDF is symmetric and bounded', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96) + normalCdf(1.96)).toBeCloseTo(1, 6);
  });

  it('tennis recursion: even players are 50/50, and leads matter', () => {
    expect(setWinProbability(0.5)).toBeCloseTo(0.5, 6);
    expect(matchWinProbability(0.5, { home: 0, away: 0 }, { home: 0, away: 0 })).toBeCloseTo(
      0.5,
      6,
    );
    expect(matchWinProbability(0.5, { home: 1, away: 0 }, { home: 5, away: 2 })).toBeGreaterThan(
      0.9,
    );
    expect(matchWinProbability(0.5, { home: 2, away: 0 }, { home: 0, away: 0 })).toBe(1);
  });
});
