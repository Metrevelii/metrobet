'use client';

import {
  PLAYER_WS,
  PLAYER_WS_NAMESPACE,
  playerBalanceMessageSchema,
  type TicketSettledMessage,
  ticketSettledMessageSchema,
  toMajor,
} from '@metrobet/contracts';
import { toast } from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent } from 'react';
import { io } from 'socket.io-client';

import { setLiveBalance } from '@/features/wallet/live-balance';
import { useRouter } from '@/i18n/navigation';

import { playerSocketPass } from './actions';

const WS_URL = (process.env.NEXT_PUBLIC_API_WS_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const BETS = '/bets';

/**
 * The signed-in player's live channel: balance changes update the header, settled tickets show a
 * toast. Mounted once (in the header) for signed-in players; renders nothing. Each (re)connect
 * fetches a fresh one-time pass, so the session token never reaches the browser.
 */
export function PlayerLive() {
  const t = useTranslations('Notifications');
  const format = useFormatter();
  const router = useRouter();

  const onTicket = useEffectEvent((ticket: TicketSettledMessage) => {
    const amount = format.number(toMajor(ticket.payout), { style: 'currency', currency: 'GEL' });
    const view = { label: t('viewBets'), onClick: () => router.push(`${BETS}?status=settled`) };
    if (ticket.status === 'won') toast.success(t('ticketWon', { amount }), { action: view });
    else if (ticket.status === 'void') toast.info(t('ticketVoid', { amount }), { action: view });
    else toast.info(t('ticketLost'), { action: view });
    // Only My bets needs fresh server data (refreshing a game page would relaunch the game).
    if (window.location.pathname.includes(BETS)) router.refresh();
  });

  useEffect(() => {
    const socket = io(`${WS_URL}${PLAYER_WS_NAMESPACE}`, {
      transports: ['websocket'],
      auth: (send) => {
        void playerSocketPass().then((pass) => send({ pass }));
      },
    });
    socket.on(PLAYER_WS.balance, (message: unknown) => {
      const parsed = playerBalanceMessageSchema.safeParse(message);
      if (parsed.success) setLiveBalance(parsed.data.balance);
    });
    socket.on(PLAYER_WS.ticketSettled, (message: unknown) => {
      const parsed = ticketSettledMessageSchema.safeParse(message);
      if (parsed.success) onTicket(parsed.data);
    });
    // Refused (signed out meanwhile): stop instead of retrying with no session.
    socket.on('exception', () => socket.disconnect());
    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}
