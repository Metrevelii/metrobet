'use client';

import {
  crashBetsMessageSchema,
  type CrashGame,
  crashMineMessageSchema,
  type CrashState,
  crashStateSchema,
  ORIGINALS_WS,
} from '@metrobet/contracts';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { request } from '../../use-originals-socket';

export type CrashView = {
  state: CrashState | null;
  /** Server clock − local clock (ms): add to Date.now() to get server time. */
  offset: number;
};

/** Joins one crash game and keeps this viewer's round state current (rejoins after reconnects). */
export function useCrash(socket: Socket | null, game: CrashGame): CrashView {
  const [view, setView] = useState<CrashView>({ state: null, offset: 0 });

  useEffect(() => {
    if (!socket) return;
    const apply = (raw: unknown) => {
      const parsed = crashStateSchema.safeParse(raw);
      if (parsed.success && parsed.data.game === game) {
        setView({ state: parsed.data, offset: parsed.data.serverTime - Date.now() });
      }
    };
    const join = async () => {
      const ack = await request<CrashState>(socket, ORIGINALS_WS.crashJoin, { game });
      if (ack.ok) apply(ack.data);
    };
    const onBets = (raw: unknown) => {
      const message = crashBetsMessageSchema.safeParse(raw);
      if (!message.success || message.data.game !== game) return;
      const { bets } = message.data;
      setView((current) =>
        current.state ? { ...current, state: { ...current.state, bets } } : current,
      );
    };
    const onMine = (raw: unknown) => {
      const message = crashMineMessageSchema.safeParse(raw);
      if (!message.success || message.data.game !== game) return;
      const { mine } = message.data;
      setView((current) =>
        current.state ? { ...current, state: { ...current.state, mine } } : current,
      );
    };

    socket.on(ORIGINALS_WS.crashState, apply);
    socket.on(ORIGINALS_WS.crashBets, onBets);
    socket.on(ORIGINALS_WS.crashMine, onMine);
    socket.on('connect', join);
    void join();
    return () => {
      socket.off(ORIGINALS_WS.crashState, apply);
      socket.off(ORIGINALS_WS.crashBets, onBets);
      socket.off(ORIGINALS_WS.crashMine, onMine);
      socket.off('connect', join);
    };
  }, [socket, game]);

  return view;
}
