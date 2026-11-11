import type { WalletAccountKind } from './wallet.schema.js';

/** Accounts owned by one player: cash (`player`) and bonus money (`bonus`). */
export type PlayerAccountKind = 'player' | 'bonus';
export type AccountRef =
  | { kind: PlayerAccountKind; playerId: string }
  | { kind: Exclude<WalletAccountKind, PlayerAccountKind> };

export const isPlayerOwned = (
  ref: AccountRef,
): ref is { kind: PlayerAccountKind; playerId: string } =>
  ref.kind === 'player' || ref.kind === 'bonus';
export type Leg = { account: AccountRef; amount: number };

export class InsufficientFundsError extends Error {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super(`Insufficient funds: balance ${balance}, requested ${requested}`);
  }
}

/** The same key was posted before with different content (player, type or amounts). */
export class IdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Idempotency key ${idempotencyKey} was already used for a different transaction`);
  }
}

export const accountKey = (ref: AccountRef) =>
  isPlayerOwned(ref) ? `${ref.kind}:${ref.playerId}` : ref.kind;

/**
 * Rejects malformed transactions before touching the database: at least two legs, non-zero
 * safe integers, one leg per account, summing to zero, and only `playerId`'s own player account.
 */
export function assertBalanced(legs: readonly Leg[], playerId: string): void {
  if (legs.length < 2) throw new Error('A transaction needs at least two legs');
  const keys = new Set(legs.map((leg) => accountKey(leg.account)));
  if (keys.size !== legs.length) throw new Error('One leg per account');
  for (const { account, amount } of legs) {
    if (!Number.isSafeInteger(amount) || amount === 0) {
      throw new Error(`Leg amounts must be non-zero integers (got ${amount})`);
    }
    if (isPlayerOwned(account) && account.playerId !== playerId) {
      throw new Error('A transaction may only move its own player’s money');
    }
  }
  if (legs.reduce((sum, leg) => sum + leg.amount, 0) !== 0) {
    throw new Error('Transaction legs must sum to zero');
  }
}

/**
 * New balances for the locked accounts (keyed by `accountKey`). Throws InsufficientFundsError
 * when a player's cash or bonus account would go below zero; system accounts may go negative.
 */
export function applyLegs(
  legs: readonly Leg[],
  balances: ReadonlyMap<string, number>,
): Map<string, number> {
  const next = new Map<string, number>();
  for (const { account, amount } of legs) {
    const key = accountKey(account);
    const balance = balances.get(key);
    if (balance === undefined) throw new Error(`Account ${key} is not locked`);
    const after = balance + amount;
    if (isPlayerOwned(account) && after < 0) throw new InsufficientFundsError(balance, -amount);
    next.set(key, after);
  }
  return next;
}

/** Order-independent description of a transaction's legs, to compare an idempotent replay. */
export const legsFingerprint = (legs: readonly Leg[]) =>
  legs
    .map((leg) => `${accountKey(leg.account)}=${leg.amount}`)
    .toSorted()
    .join(',');

/** How a stake is paid: cash first, then bonus money. Throws when both together don't cover it. */
export function splitStake(amount: number, cash: number, bonus: number) {
  if (cash + bonus < amount) throw new InsufficientFundsError(cash + bonus, amount);
  const fromCash = Math.min(amount, cash);
  return { fromCash, fromBonus: amount - fromCash };
}

/**
 * The bonus-money part of a payout on a stake that was partly bonus money: proportional,
 * rounded down (the tetri of rounding go to cash).
 */
export const bonusShare = (payout: number, stake: number, bonusStake: number) =>
  stake <= 0 || bonusStake <= 0 ? 0 : Math.floor((payout * bonusStake) / stake);

/** Legs paying `amount` from `from` (the house by default) to the player, `bonusPart` as bonus money. */
export function payoutLegs(
  playerId: string,
  amount: number,
  bonusPart = 0,
  from: AccountRef = { kind: 'house' },
): Leg[] {
  const legs: Leg[] = [{ account: from, amount: -amount }];
  if (amount - bonusPart > 0) {
    legs.push({ account: { kind: 'player', playerId }, amount: amount - bonusPart });
  }
  if (bonusPart > 0) legs.push({ account: { kind: 'bonus', playerId }, amount: bonusPart });
  return legs;
}
