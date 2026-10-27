'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Tiny client mirror of "is someone signed in", for client components outside the header
 * (e.g. the betslip). The server is the source of truth: <SessionSync> publishes its answer.
 */
let signedIn: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** true / false once known, null before the server answer arrives. */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => signedIn,
    () => null,
  );
}

export function SessionSync({ signedIn: value }: { signedIn: boolean }) {
  useEffect(() => {
    signedIn = value;
    for (const listener of listeners) listener();
  }, [value]);
  return null;
}
