'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 60_000;

let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(timer);
  };
}

const getSnapshot = () => (now ??= Date.now());
const getServerSnapshot = () => null;

/**
 * Current time (ms), refreshed every minute. `null` during prerender and hydration, so
 * time-dependent UI (like a promotion's status) is never baked into static HTML.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
