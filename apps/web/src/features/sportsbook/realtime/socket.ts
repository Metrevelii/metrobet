'use client';

import { type EventUpdate, SPORTSBOOK_WS, SPORTSBOOK_WS_NAMESPACE } from '@metrobet/contracts';
import { io, type Socket } from 'socket.io-client';

import { applyUpdate } from './live-store';

const WS_URL = (process.env.NEXT_PUBLIC_API_WS_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** One shared connection; event subscriptions are reference-counted across components. */
let socket: Socket | null = null;
const refCounts = new Map<string, number>();
const liveChangedListeners = new Set<() => void>();

async function requestSnapshot(eventIds: string[]) {
  if (!socket?.connected || eventIds.length === 0) return;
  try {
    const snapshot = (await socket
      .timeout(5000)
      .emitWithAck(SPORTSBOOK_WS.subscribe, { eventIds })) as EventUpdate[];
    snapshot.forEach(applyUpdate);
  } catch {
    // Timed out: updates still arrive; the next reconnect re-subscribes.
  }
}

function connection(): Socket {
  if (socket) return socket;
  socket = io(`${WS_URL}${SPORTSBOOK_WS_NAMESPACE}`, { transports: ['websocket'] });
  socket.on(SPORTSBOOK_WS.update, applyUpdate);
  socket.on(SPORTSBOOK_WS.liveChanged, () =>
    liveChangedListeners.forEach((listener) => listener()),
  );
  // (Re)connect: rejoin every room still in use and resync its state.
  socket.on('connect', () => void requestSnapshot([...refCounts.keys()]));
  return socket;
}

export function subscribeEvents(eventIds: string[]): () => void {
  connection();
  const fresh = eventIds.filter((id) => !refCounts.has(id));
  for (const id of eventIds) refCounts.set(id, (refCounts.get(id) ?? 0) + 1);
  void requestSnapshot(fresh);

  return () => {
    const released: string[] = [];
    for (const id of eventIds) {
      const count = (refCounts.get(id) ?? 1) - 1;
      if (count > 0) refCounts.set(id, count);
      else {
        refCounts.delete(id);
        released.push(id);
      }
    }
    if (released.length > 0 && socket?.connected)
      socket.emit(SPORTSBOOK_WS.unsubscribe, { eventIds: released });
  };
}

export function onLiveChanged(listener: () => void): () => void {
  connection();
  liveChangedListeners.add(listener);
  return () => liveChangedListeners.delete(listener);
}
