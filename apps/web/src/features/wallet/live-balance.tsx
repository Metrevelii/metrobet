'use client';

import { toMajor } from '@metrobet/contracts';
import { useFormatter } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Client mirror of the balance while a game runs: the game frame reports each new balance
 * (`setLiveBalance`) so the header follows without a page refresh (which would reload the
 * game). The header keys `LiveBalance` by the server value, so a new one (deposit + refresh)
 * remounts it and drops the live value.
 */
let live: number | null = null;
const listeners = new Set<() => void>();

function publish(value: number | null) {
  live = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLiveBalance(balance: number) {
  publish(balance);
}

/** The header amount: the live value when a game reported one, else the server's. */
export function LiveBalance({ balance, currency }: { balance: number; currency: string }) {
  const format = useFormatter();
  const value = useSyncExternalStore(
    subscribe,
    () => live,
    () => null,
  );
  useEffect(() => publish(null), []);
  return format.number(toMajor(value ?? balance), { style: 'currency', currency });
}
