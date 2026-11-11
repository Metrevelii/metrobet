import {
  LIMIT_INCREASE_DELAY_MS,
  LIMIT_KINDS,
  LIMIT_PERIODS,
  type LimitExceeded,
  type LimitKind,
  type LimitPeriod,
} from '@metrobet/contracts';

import type { PlayerActivityTotals } from '../wallet/wallet.service.js';

/** A stored limit: what is in force, and a raise or removal waiting for `pendingAt`. */
export type LimitState = {
  amount: number | null;
  pendingAmount: number | null;
  pendingAt: Date | null;
};

export const NO_LIMIT: LimitState = { amount: null, pendingAmount: null, pendingAt: null };

/** Applies a pending change whose time has come. */
export function resolveLimit(state: LimitState, now: Date): LimitState {
  if (state.pendingAt && state.pendingAt <= now) {
    return { amount: state.pendingAmount, pendingAmount: null, pendingAt: null };
  }
  return { amount: state.amount, pendingAmount: state.pendingAmount, pendingAt: state.pendingAt };
}

/**
 * The player asks for `next` (null = no limit). Stricter (a new limit, or a lower one) applies
 * at once and cancels any pending raise; looser (higher, or removal) waits a day, while the
 * current limit stays in force. Asking for the current amount cancels a pending change.
 */
export function changeLimit(current: LimitState, next: number | null, now: Date): LimitState {
  const { amount } = resolveLimit(current, now);
  const stricter = next !== null && (amount === null || next < amount);
  if (stricter || next === amount) return { amount: next, pendingAmount: null, pendingAt: null };
  return {
    amount,
    pendingAmount: next,
    pendingAt: new Date(now.getTime() + LIMIT_INCREASE_DELAY_MS),
  };
}

/** What counts against a limit of this kind (never negative). */
export function usedOf(kind: LimitKind, activity: PlayerActivityTotals): number {
  if (kind === 'deposit') return activity.deposits;
  if (kind === 'stake') return activity.stakes;
  return Math.max(0, activity.stakes - activity.returns);
}

export type InForce = { kind: LimitKind; period: LimitPeriod; amount: number };

/**
 * The first limit that `amount` more of `kinds` would break, or null. A new stake counts fully
 * towards both the stake and the loss limits (it may be lost).
 */
export function firstExceeded(
  limits: InForce[],
  usage: Map<LimitPeriod, PlayerActivityTotals>,
  kinds: LimitKind[],
  amount: number,
): LimitExceeded | null {
  for (const limit of limits) {
    if (!kinds.includes(limit.kind)) continue;
    const used = usedOf(limit.kind, usage.get(limit.period)!);
    if (used + amount > limit.amount) {
      return {
        kind: limit.kind,
        period: limit.period,
        remaining: Math.max(0, limit.amount - used),
      };
    }
  }
  return null;
}

/** Every kind × period, in the order the player's page shows them. */
export const ALL_LIMITS = LIMIT_KINDS.flatMap((kind) =>
  LIMIT_PERIODS.map((period) => ({ kind, period })),
);
