'use client';

import {
  balanceMessageSchema,
  ORIGINALS_WS,
  ORIGINALS_WS_NAMESPACE,
  type OriginalLaunch,
  type OriginalsAck,
} from '@metrobet/contracts';
import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { setLiveBalance } from '@/features/wallet/live-balance';

const WS_URL = (process.env.NEXT_PUBLIC_API_WS_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const ACK_TIMEOUT_MS = 10_000;

type ConnectionState = {
  socket: Socket | null;
  /** `failed`: the session was refused (expired, signed out elsewhere): reload to start over. */
  status: 'connecting' | 'ready' | 'failed';
  balance: number | null;
};

export type OriginalsConnection = ConnectionState & {
  /** Shows a balance the game learned itself (e.g. revealed after a spin animation). */
  updateBalance: (balance: number) => void;
};

/** Emits and waits for the server's ack; a timeout or dropped connection reads as UNAVAILABLE. */
export async function request<T>(
  socket: Socket,
  event: string,
  payload?: unknown,
): Promise<OriginalsAck<T>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as OriginalsAck<T>;
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

/**
 * One Socket.IO connection to the Originals game server for this launch (`auth.session` = the
 * launch token). Tracks the balance it reports; in real mode the header balance follows it.
 */
export function useOriginalsSocket({ session, mode }: OriginalLaunch): OriginalsConnection {
  const [state, setState] = useState<ConnectionState>({
    socket: null,
    status: 'connecting',
    balance: null,
  });

  useEffect(() => {
    const socket = io(`${WS_URL}${ORIGINALS_WS_NAMESPACE}`, {
      auth: { session },
      transports: ['websocket'],
    });
    socket.on(ORIGINALS_WS.balance, (message: unknown) => {
      const parsed = balanceMessageSchema.safeParse(message);
      if (!parsed.success) return;
      setState({ socket, status: 'ready', balance: parsed.data.balance });
      if (mode === 'real') setLiveBalance(parsed.data.balance);
    });
    // The server refuses the session and disconnects: don't keep retrying with it.
    socket.on('exception', () => {
      socket.disconnect();
      setState({ socket: null, status: 'failed', balance: null });
    });
    return () => {
      socket.disconnect();
    };
  }, [session, mode]);

  const updateBalance = useCallback(
    (balance: number) => {
      setState((current) => ({ ...current, balance }));
      if (mode === 'real') setLiveBalance(balance);
    },
    [mode],
  );

  return { ...state, updateBalance };
}
