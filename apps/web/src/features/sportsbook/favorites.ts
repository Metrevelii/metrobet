'use client';

import { useSyncExternalStore } from 'react';

/**
 * Favourite leagues (competition ids), per browser. Moves to the player account later, like the
 * casino favourites.
 */
const STORAGE_KEY = 'mb.favoriteLeagues';
const MAX = 30;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    cache = Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string').slice(0, MAX)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Favourite league ids ([] before hydration). */
export function useFavoriteLeagues(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFavoriteLeague(id: string) {
  const current = read();
  cache = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id].slice(-MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable: keep them for this session.
  }
  for (const listener of listeners) listener();
}
