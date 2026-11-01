import type { AddressInfo } from 'node:net';

import {
  PLAYER_WS,
  PLAYER_WS_NAMESPACE,
  type PlayerBalanceMessage,
  type TicketSettledMessage,
} from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { SettlementService } from '../src/modules/betting/settlement.service.js';
import { SportsbookStore } from '../src/modules/sportsbook/sportsbook.store.js';
import { createTestApp } from './create-app.js';

type Headers = Record<string, string>;

/** The next `event` on the socket (fails after 5 s). */
const next = <T>(socket: Socket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event}`)), 5_000);
    socket.once(event, (message: T) => {
      clearTimeout(timer);
      resolve(message);
    });
  });

describe('player live channel (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let baseUrl: string;
  const sockets: Socket[] = [];
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async () => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `live-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    return { authorization: `Bearer ${body.session.token}` } as Headers;
  };
  const pass = async (headers: Headers) =>
    (await http().post('/api/player-live/pass').set(headers).expect(200)).body.pass as string;
  const connect = (value: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`${baseUrl}${PLAYER_WS_NAMESPACE}`, {
        auth: { pass: value },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      // The server checks the pass right after connecting; give it a moment to refuse.
      socket.once('connect', () =>
        setTimeout(() => (socket.connected ? resolve(socket) : undefined), 150),
      );
      socket.once('disconnect', () => reject(new Error('disconnected')));
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
    const store = ctx.app.get(SportsbookStore);
    for (let i = 0; i < 50 && store.sports().every((s) => s.upcomingCount === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await ctx?.app.close();
  });

  it('needs a valid, unused pass', async () => {
    await http().post('/api/player-live/pass').expect(401);
    await expect(connect('not-a-pass')).rejects.toThrow('disconnected');
    const headers = await signUp();
    const value = await pass(headers);
    await connect(value);
    await expect(connect(value)).rejects.toThrow('disconnected'); // single use
  });

  it('pushes balance changes after they commit, and nothing for a rollback', async () => {
    const headers = await signUp();
    const socket = await connect(await pass(headers));

    const pushed = next<PlayerBalanceMessage>(socket, PLAYER_WS.balance);
    await http().post('/api/dev/wallet/deposit').set(headers).send({ amount: 25_00 }).expect(200);
    expect(await pushed).toEqual({ balance: 25_00 });

    // A change that rolls back is never announced.
    const silent = vi.fn();
    socket.on(PLAYER_WS.balance, silent);
    await ctx.db
      .transaction(async (tx) => {
        await tx.execute(
          sql`update wallet_accounts set balance = balance + 1 where kind = 'player'`,
        );
        throw new Error('rollback');
      })
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(silent).not.toHaveBeenCalled();
  });

  it('pushes a settled ticket with its payout', async () => {
    const headers = await signUp();
    await http().post('/api/dev/wallet/deposit').set(headers).send({ amount: 10_00 }).expect(200);
    const store = ctx.app.get(SportsbookStore);
    const event = store
      .overview('football')
      .upcoming.flatMap((group) => group.events)
      .map((summary) => store.event(summary.id)!)
      .find((item) => item.markets.some((m) => m.type === '1x2' && m.status === 'open'))!;
    const home = event.markets
      .find((m) => m.type === '1x2')!
      .selections.find((s) => s.key === 'home')!;
    const { body } = await http()
      .post('/api/sportsbook/bets')
      .set(headers)
      .send({
        idempotencyKey: crypto.randomUUID(),
        mode: 'single',
        selections: [{ selectionId: home.id, odds: home.odds }],
        stakes: [2_00],
      })
      .expect(200);
    const socket = await connect(await pass(headers));

    const settled = next<TicketSettledMessage>(socket, PLAYER_WS.ticketSettled);
    const balance = next<PlayerBalanceMessage>(socket, PLAYER_WS.balance);
    await ctx.app.get(SettlementService).settleEvent({
      eventId: event.id,
      sport: 'football',
      final: { period: 'FT', clock: null, score: { home: 2, away: 0 }, periodScores: [] },
    });
    const payout = Math.floor((2_00 * Math.round(home.odds * 100)) / 100);
    expect(await settled).toEqual({
      ticketId: body.tickets[0].id,
      status: 'won',
      mode: 'single',
      stake: 2_00,
      payout,
    });
    expect(await balance).toEqual({ balance: 8_00 + payout });
  });
});
