import { z } from 'zod';

/**
 * Supra Fortune: Metrobet Originals slot, 5 reels × 3 rows, 10 fixed paylines, Georgian feast
 * theme. Pure game rules shared by the game server (which picks the stops) and the client (which
 * draws them). RTP ≈ 96.27 % (exact, see the API spec).
 */
export const SUPRA_SYMBOLS = [
  'grape',
  'cheese',
  'bread',
  'khinkali',
  'wine',
  'horn',
  'qvevri',
  'tamada',
] as const;
export type SupraSymbol = (typeof SUPRA_SYMBOLS)[number];

/** Index of the wild (the tamada leads the feast): stands in for any symbol on a line. */
export const SUPRA_WILD = 7;
export const SUPRA_REELS = 5;
export const SUPRA_ROWS = 3;

/** Line pays for 3, 4 and 5 of a kind, in line bets (line bet = total bet / 10). */
export const SUPRA_PAYS: readonly (readonly [number, number, number])[] = [
  [5, 15, 50],
  [5, 15, 50],
  [8, 20, 80],
  [10, 30, 120],
  [15, 50, 200],
  [20, 80, 300],
  [40, 150, 600],
  [50, 250, 1000],
];

/** How often each symbol appears on every reel strip (same order as SUPRA_SYMBOLS). */
const STRIP_COUNTS = [6, 6, 5, 5, 3, 3, 2, 2];

/** Spreads each symbol evenly along a strip (deterministic), then offsets each reel. */
function buildStrip(offset: number): number[] {
  const length = STRIP_COUNTS.reduce((sum, count) => sum + count, 0);
  const slots = STRIP_COUNTS.flatMap((count, symbol) =>
    Array.from({ length: count }, (_, i) => ({
      symbol,
      at: ((i + 0.5) * length) / count + symbol * 0.01,
    })),
  ).toSorted((a, b) => a.at - b.at);
  const strip = slots.map((slot) => slot.symbol);
  return [...strip.slice(offset % length), ...strip.slice(0, offset % length)];
}

/** Reel strips (symbol indexes). A spin picks one stop per reel; rows are stop, stop+1, stop+2. */
export const SUPRA_STRIPS: readonly number[][] = Array.from({ length: SUPRA_REELS }, (_, reel) =>
  buildStrip(reel * 7),
);

/** Row (0 = top) of each reel for the 10 paylines. */
export const SUPRA_PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 2, 1, 0, 1],
];

/** Total bets offered, in minor units (0.20 ₾ … 50 ₾). Divisible by the 10 lines. */
export const SUPRA_BETS = [20, 50, 1_00, 2_00, 5_00, 10_00, 20_00, 50_00];

/** The visible grid for a set of stops: `grid[reel][row]` symbol indexes. */
export function supraGrid(stops: readonly number[]): number[][] {
  return SUPRA_STRIPS.map((strip, reel) =>
    Array.from({ length: SUPRA_ROWS }, (_, row) => strip[(stops[reel]! + row) % strip.length]!),
  );
}

/** Pay of one line, in line bets: best of the leading-wild run and the first symbol's run. */
export function supraLinePay(
  symbols: readonly number[],
): { symbol: number; count: number; pay: number } | null {
  let wilds = 0;
  while (wilds < symbols.length && symbols[wilds] === SUPRA_WILD) wilds++;
  let best =
    wilds >= 3
      ? { symbol: SUPRA_WILD, count: wilds, pay: SUPRA_PAYS[SUPRA_WILD]![wilds - 3]! }
      : null;
  if (wilds === symbols.length) return best;

  const target = symbols[wilds]!;
  let count = wilds;
  while (count < symbols.length && (symbols[count] === target || symbols[count] === SUPRA_WILD))
    count++;
  if (count >= 3) {
    const pay = SUPRA_PAYS[target]![count - 3]!;
    if (!best || pay > best.pay) best = { symbol: target, count, pay };
  }
  return best;
}

export const supraLineWinSchema = z.object({
  line: z.number().int().min(0),
  symbol: z.number().int().min(0),
  count: z.number().int().min(3).max(SUPRA_REELS),
  amount: z.number().int().positive(),
});
export type SupraLineWin = z.infer<typeof supraLineWinSchema>;

/** Every winning line for a grid and total bet (minor units). */
export function supraWins(grid: readonly (readonly number[])[], bet: number): SupraLineWin[] {
  const lineBet = bet / SUPRA_PAYLINES.length;
  return SUPRA_PAYLINES.flatMap((rows, line) => {
    const result = supraLinePay(rows.map((row, reel) => grid[reel]![row]!));
    return result
      ? [
          {
            line,
            symbol: result.symbol,
            count: result.count,
            amount: Math.round(result.pay * lineBet),
          },
        ]
      : [];
  });
}

export const supraSpinRequestSchema = z.object({
  bet: z.number().refine((bet) => SUPRA_BETS.includes(bet), 'Not an offered bet'),
});

export const supraSpinResultSchema = z.object({
  stops: z.array(z.number().int().min(0)).length(SUPRA_REELS),
  wins: z.array(supraLineWinSchema),
  win: z.number().int().min(0),
  balance: z.number().int().min(0),
});
export type SupraSpinResult = z.infer<typeof supraSpinResultSchema>;
