import { randomInt } from 'node:crypto';

/** Reel symbols, from least to most valuable. */
export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'] as const;

/** Three of a kind pays this many times the bet, per symbol (same order as SLOT_SYMBOLS). */
const TRIPLE_PAYS = [5, 8, 10, 13, 20, 30];
/** Two equal neighbours (not three) pay this many times the bet. */
const PAIR_PAYS = 2;

/** Bet sizes offered by the mock slot, in minor units (1 ₾ … 50 ₾). */
export const SLOT_BETS = [1_00, 2_00, 5_00, 10_00, 20_00, 50_00];

export type SlotOutcome = { reels: number[]; multiplier: number };

/** Payout multiplier for three reel stops (indexes into SLOT_SYMBOLS). */
export function slotMultiplier([a, b, c]: number[]): number {
  if (a === b && b === c) return TRIPLE_PAYS[a!]!;
  return a === b || b === c ? PAIR_PAYS : 0;
}

/** One spin: uniform, independent reels from a CSPRNG. The server decides; the client animates. */
export function spinSlot(): SlotOutcome {
  const reels = Array.from({ length: 3 }, () => randomInt(SLOT_SYMBOLS.length));
  return { reels, multiplier: slotMultiplier(reels) };
}

/** Theoretical return to player over every reel combination (≈ 95.4 %). */
export function slotRtp(): number {
  const n = SLOT_SYMBOLS.length;
  let total = 0;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) total += slotMultiplier([a, b, c]);
  return total / n ** 3;
}
