import { LIMIT_INCREASE_DELAY_MS } from '@metrobet/contracts';
import { describe, expect, it } from 'vitest';

import { changeLimit, firstExceeded, NO_LIMIT, resolveLimit, usedOf } from './limits.js';

const now = new Date('2026-11-11T12:00:00Z');
const later = (ms: number) => new Date(now.getTime() + ms);

describe('changeLimit', () => {
  it('applies a first limit and a lower one at once', () => {
    const first = changeLimit(NO_LIMIT, 100_00, now);
    expect(first).toEqual({ amount: 100_00, pendingAmount: null, pendingAt: null });
    expect(changeLimit(first, 50_00, now).amount).toBe(50_00);
  });

  it('delays a raise and a removal by a day, keeping the current limit', () => {
    const current = { amount: 100_00, pendingAmount: null, pendingAt: null };
    const raised = changeLimit(current, 500_00, now);
    expect(raised).toEqual({
      amount: 100_00,
      pendingAmount: 500_00,
      pendingAt: later(LIMIT_INCREASE_DELAY_MS),
    });
    const removed = changeLimit(current, null, now);
    expect(removed.amount).toBe(100_00);
    expect(removed.pendingAmount).toBeNull();
    expect(removed.pendingAt).toEqual(later(LIMIT_INCREASE_DELAY_MS));
  });

  it('a lower limit or the current amount cancels a pending raise', () => {
    const raised = changeLimit(
      { amount: 100_00, pendingAmount: null, pendingAt: null },
      500_00,
      now,
    );
    expect(changeLimit(raised, 80_00, now)).toEqual({
      amount: 80_00,
      pendingAmount: null,
      pendingAt: null,
    });
    expect(changeLimit(raised, 100_00, now).pendingAt).toBeNull();
  });

  it('a pending change becomes the limit once due', () => {
    const raised = changeLimit(
      { amount: 100_00, pendingAmount: null, pendingAt: null },
      500_00,
      now,
    );
    expect(resolveLimit(raised, later(LIMIT_INCREASE_DELAY_MS - 1)).amount).toBe(100_00);
    expect(resolveLimit(raised, later(LIMIT_INCREASE_DELAY_MS))).toEqual({
      amount: 500_00,
      pendingAmount: null,
      pendingAt: null,
    });
    // Raising again after it applied starts from the new limit.
    expect(changeLimit(raised, 300_00, later(LIMIT_INCREASE_DELAY_MS)).amount).toBe(300_00);
  });
});

describe('firstExceeded', () => {
  const usage = new Map([
    ['day' as const, { deposits: 50_00, stakes: 40_00, returns: 15_00 }],
    ['week' as const, { deposits: 50_00, stakes: 40_00, returns: 15_00 }],
  ]);

  it('counts loss as stakes minus returns, never below zero', () => {
    expect(usedOf('loss', { deposits: 0, stakes: 40_00, returns: 15_00 })).toBe(25_00);
    expect(usedOf('loss', { deposits: 0, stakes: 10_00, returns: 15_00 })).toBe(0);
  });

  it('reports the limit and what is left of it', () => {
    const limits = [
      { kind: 'stake' as const, period: 'week' as const, amount: 100_00 },
      { kind: 'loss' as const, period: 'day' as const, amount: 30_00 },
    ];
    expect(firstExceeded(limits, usage, ['stake', 'loss'], 5_00)).toBeNull();
    expect(firstExceeded(limits, usage, ['stake', 'loss'], 6_00)).toEqual({
      kind: 'loss',
      period: 'day',
      remaining: 5_00,
    });
    expect(firstExceeded(limits, usage, ['deposit'], 1_000_00)).toBeNull();
  });
});
