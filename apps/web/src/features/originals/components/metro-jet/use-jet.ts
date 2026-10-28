'use client';

import {
  type JetMyBet,
  type JetPublicBet,
  type JetState,
  jetStateSchema,
  ORIGINALS_WS,
} from '@metrobet/contracts';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { request } from '../../use-originals-socket';

export type JetView = {
  state: JetState | null;
  /** Server clock − local clock (ms): add to Date.now() to get server time. */
  offset: number;
};

/** Joins Metro Jet and keeps this viewer's round state current (rejoins after reconnects). */
export function useJet(socket: Socket | null): JetView {
  const [view, setView] = useState<JetView>({ state: null, offset: 0 });

  useEffect(() => {
    if (!socket) return;
    const apply = (raw: unknown) => {
      const parsed = jetStateSchema.safeParse(raw);
      if (parsed.success) {
        setView({ state: parsed.data, offset: parsed.data.serverTime - Date.now() });
      }
    };
    const join = async () => {
      const ack = await request<JetState>(socket, ORIGINALS_WS.jetJoin);
      if (ack.ok) apply(ack.data);
    };
    const onBets = (bets: JetPublicBet[]) =>
      setView((current) =>
        current.state ? { ...current, state: { ...current.state, bets } } : current,
      );
    const onMine = (mine: JetMyBet[]) =>
      setView((current) =>
        current.state ? { ...current, state: { ...current.state, mine } } : current,
      );

    socket.on(ORIGINALS_WS.jetState, apply);
    socket.on(ORIGINALS_WS.jetBets, onBets);
    socket.on(ORIGINALS_WS.jetMine, onMine);
    socket.on('connect', join);
    void join();
    return () => {
      socket.off(ORIGINALS_WS.jetState, apply);
      socket.off(ORIGINALS_WS.jetBets, onBets);
      socket.off(ORIGINALS_WS.jetMine, onMine);
      socket.off('connect', join);
    };
  }, [socket]);

  return view;
}
