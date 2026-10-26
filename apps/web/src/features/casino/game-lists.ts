'use client';

import { type GameCard, gameCardSchema } from '@metrobet/contracts';
import { useSyncExternalStore } from 'react';

/**
 * Per-browser game lists (favorites, recently played) in localStorage. Stores whole cards so
 * the lists render without an API call. Moves to the player account once auth exists.
 */
type ListKey = 'favorites' | 'recent';

const STORAGE_KEYS: Record<ListKey, string> = {
  favorites: 'mb.casino.favorites',
  recent: 'mb.casino.recent',
};
const LIMITS: Record<ListKey, number> = { favorites: 100, recent: 12 };
const listSchema = gameCardSchema.array().catch([]);

const cache = new Map<ListKey, GameCard[]>();
const listeners = new Set<() => void>();

function read(key: ListKey): GameCard[] {
  const cached = cache.get(key);
  if (cached) return cached;
  let list: GameCard[] = [];
  try {
    list = listSchema.parse(JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) ?? '[]'));
  } catch {
    // Storage blocked or corrupted: start empty.
  }
  cache.set(key, list);
  return list;
}

function write(key: ListKey, list: GameCard[]) {
  const next = list.slice(0, LIMITS[key]);
  cache.set(key, next);
  try {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(next));
  } catch {
    // Quota exceeded or storage blocked: keep the in-memory value for this session.
  }
  for (const notify of listeners) notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (Object.values(STORAGE_KEYS).includes(event.key ?? '')) {
      cache.clear();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The list, or null before hydration (server render has no storage). */
export function useGameList(key: ListKey): GameCard[] | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

export function toggleFavorite(game: GameCard) {
  const list = read('favorites');
  write(
    'favorites',
    list.some((item) => item.slug === game.slug)
      ? list.filter((item) => item.slug !== game.slug)
      : [game, ...list],
  );
}

export function addRecentlyPlayed(game: GameCard) {
  write('recent', [game, ...read('recent').filter((item) => item.slug !== game.slug)]);
}
