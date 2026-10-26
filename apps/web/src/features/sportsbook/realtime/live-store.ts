'use client';

import type { EventStatus, EventUpdate, LiveState, MarketStatus } from '@metrobet/contracts';
import type { Selection } from '@metrobet/contracts';
import { useMemo, useSyncExternalStore } from 'react';

/**
 * Client-side live state keyed by selection / event id, fed by Socket.IO updates. Components
 * subscribe to a single key, so a price change re-renders only the buttons that show it.
 * Server-rendered snapshot values are used until the first update arrives.
 */

export type SelectionLiveState = {
  odds: number;
  active: boolean;
  marketStatus: MarketStatus;
  /** Odds before the latest change, to show the direction. */
  previousOdds: number | null;
  /** Increments on every price change (restarts the flash animation). */
  version: number;
};

export type EventLiveState = { status: EventStatus; live: LiveState | null };

const selections = new Map<string, SelectionLiveState>();
const events = new Map<string, EventLiveState>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

const subscribers = new Map<string, (listener: () => void) => () => void>();

/** Stable subscribe function per key (useSyncExternalStore re-subscribes when it changes). */
function subscribeKey(key: string) {
  let subscribe = subscribers.get(key);
  if (!subscribe) {
    subscribe = (listener) => {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(key);
      };
    };
    subscribers.set(key, subscribe);
  }
  return subscribe;
}

export function applyUpdate(update: EventUpdate) {
  events.set(update.eventId, { status: update.status, live: update.live });
  notify(`event:${update.eventId}`);

  for (const market of update.markets) {
    for (const selection of market.selections) {
      const prev = selections.get(selection.id);
      const moved = prev !== undefined && prev.odds !== selection.odds;
      const next: SelectionLiveState = {
        odds: selection.odds,
        active: selection.active,
        marketStatus: market.status,
        previousOdds: moved ? prev.odds : (prev?.previousOdds ?? null),
        version: moved ? prev.version + 1 : (prev?.version ?? 0),
      };
      if (
        prev &&
        prev.odds === next.odds &&
        prev.active === next.active &&
        prev.marketStatus === next.marketStatus
      )
        continue;
      selections.set(selection.id, next);
      notify(`selection:${selection.id}`);
    }
  }
}

/** Live state of a selection; the server snapshot is used until the first update arrives. */
export function useSelectionLiveState(
  selection: Selection,
  marketStatus: MarketStatus,
): SelectionLiveState {
  const fallback = useMemo<SelectionLiveState>(
    () => ({
      odds: selection.odds,
      active: selection.active,
      marketStatus,
      previousOdds: null,
      version: 0,
    }),
    [selection.odds, selection.active, marketStatus],
  );
  return useSyncExternalStore(
    subscribeKey(`selection:${selection.id}`),
    () => selections.get(selection.id) ?? fallback,
    () => fallback,
  );
}

/** Live score/status of an event; the server snapshot is used until the first update arrives. */
export function useEventLiveState(event: {
  id: string;
  status: EventStatus;
  live: LiveState | null;
}): EventLiveState {
  const fallback = useMemo<EventLiveState>(
    () => ({ status: event.status, live: event.live }),
    [event.status, event.live],
  );
  return useSyncExternalStore(
    subscribeKey(`event:${event.id}`),
    () => events.get(event.id) ?? fallback,
    () => fallback,
  );
}

/**
 * Re-renders when any of the given selections change. Returns a signature string; read the
 * values with `peekSelection` during the same render.
 */
export function useSelectionsSignature(ids: string[]): string {
  const key = ids.join(',');
  const subscribe = useMemo(() => {
    const unsubscribers = key ? key.split(',').map((id) => subscribeKey(`selection:${id}`)) : [];
    return (listener: () => void) => {
      const cleanups = unsubscribers.map((sub) => sub(listener));
      return () => cleanups.forEach((cleanup) => cleanup());
    };
  }, [key]);
  const signature = () =>
    ids
      .map((id) => {
        const s = selections.get(id);
        return s ? `${s.odds}:${s.active}:${s.marketStatus}` : '';
      })
      .join('|');
  return useSyncExternalStore(subscribe, signature, () => '');
}

export const peekSelection = (id: string): SelectionLiveState | undefined => selections.get(id);

/** Current odds of a selection outside React (e.g. accepting betslip changes). */
export function currentOdds(id: string): number | undefined {
  return selections.get(id)?.odds;
}
