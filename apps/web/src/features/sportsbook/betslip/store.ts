'use client';

import { marketTypeSchema, selectionKeySchema, sportSchema } from '@metrobet/contracts';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { currentOdds } from '../realtime/live-store';

/**
 * Betslip, persisted per browser. Keeps everything needed to render a selection without a
 * fetch; live odds come from the live store. Moves server-side when bet placement exists.
 */
const itemSchema = z.object({
  selectionId: z.string(),
  marketId: z.string(),
  eventId: z.string(),
  sport: sportSchema,
  home: z.object({ name: z.string(), abbreviation: z.string() }),
  away: z.object({ name: z.string(), abbreviation: z.string() }),
  marketType: marketTypeSchema,
  line: z.number().nullable(),
  selectionKey: selectionKeySchema,
  /** Odds the player accepted; differs from the live price after a change. */
  odds: z.number(),
});
export type BetslipItem = z.infer<typeof itemSchema>;

const stateSchema = z.object({
  items: z.array(itemSchema),
  mode: z.enum(['single', 'combo']),
  stakes: z.record(z.string(), z.number()),
  comboStake: z.number(),
});
export type BetslipState = z.infer<typeof stateSchema>;
export type BetslipMode = BetslipState['mode'];

const STORAGE_KEY = 'mb.betslip';
const MAX_ITEMS = 20;
export const DEFAULT_STAKE = 5;
const EMPTY: BetslipState = { items: [], mode: 'single', stakes: {}, comboStake: DEFAULT_STAKE };

let state: BetslipState | null = null;
const listeners = new Set<() => void>();

function read(): BetslipState {
  if (state) return state;
  try {
    state = stateSchema
      .catch(EMPTY)
      .parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? EMPTY);
  } catch {
    state = EMPTY;
  }
  return state;
}

function write(next: BetslipState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory betslip for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The betslip, or null before hydration. */
export function useBetslip(): BetslipState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function useInBetslip(selectionId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read().items.some((item) => item.selectionId === selectionId),
    () => false,
  );
}

/**
 * Adds a selection, or removes it if already there. Picking another outcome of the same market
 * replaces the previous one. The second event switches the slip to accumulator mode.
 */
export function toggleSelection(item: BetslipItem) {
  const current = read();
  if (current.items.some((i) => i.selectionId === item.selectionId)) {
    removeSelection(item.selectionId);
    return;
  }
  const items = [...current.items.filter((i) => i.marketId !== item.marketId), item].slice(
    -MAX_ITEMS,
  );
  const events = new Set(items.map((i) => i.eventId));
  const mode =
    current.mode === 'single' && current.items.length === 1 && events.size > 1
      ? 'combo'
      : current.mode;
  write({
    ...current,
    items,
    mode,
    stakes: {
      ...current.stakes,
      [item.selectionId]: current.stakes[item.selectionId] ?? DEFAULT_STAKE,
    },
  });
}

export function removeSelection(selectionId: string) {
  const current = read();
  const { [selectionId]: _removed, ...stakes } = current.stakes;
  const items = current.items.filter((item) => item.selectionId !== selectionId);
  write({ ...current, items, stakes, mode: items.length <= 1 ? 'single' : current.mode });
}

export const clearBetslip = () => write(EMPTY);
export const setMode = (mode: BetslipMode) => write({ ...read(), mode });
export const setStake = (selectionId: string, stake: number) =>
  write({ ...read(), stakes: { ...read().stakes, [selectionId]: stake } });
export const setComboStake = (comboStake: number) => write({ ...read(), comboStake });

/** Accepts the latest live price of every selection. */
export function acceptOddsChanges() {
  const current = read();
  write({
    ...current,
    items: current.items.map((item) => ({
      ...item,
      odds: currentOdds(item.selectionId) ?? item.odds,
    })),
  });
}
