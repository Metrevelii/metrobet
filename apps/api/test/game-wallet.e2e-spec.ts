import { createHmac } from 'node:crypto';

import {
  GAME_WALLET_SIGNATURE_HEADER,
  type GameWalletOperation,
  type WalletTransactionsPage,
} from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { activityEvents } from '../src/modules/activity/activity.schema.js';
import {
  GameWalletClient,
  type RawResponse,
} from '../src/common/game-wallet/game-wallet-client.js';
import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { CasinoModule } from '../src/modules/casino/casino.module.js';
import { CasinoService } from '../src/modules/casino/casino.service.js';
import { casinoGameSessions } from '../src/modules/casino/game-sessions.schema.js';
import { gameRounds } from '../src/modules/game-wallet/game-wallet.schema.js';
import { createTestApp } from './create-app.js';
import { E2E_ENV } from './e2e-env.js';

type Player = { id: string; headers: Record<string, string> };

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

describe('game wallet (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let slot: string;
  let crash: string;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (deposit = 0): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `game-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    const player = {
      id: body.player.id as string,
      headers: { authorization: `Bearer ${body.session.token}` },
    };
    if (deposit) {
      await http()
        .post('/api/dev/wallet/deposit')
        .set(player.headers)
        .send({ amount: deposit })
        .expect(200);
    }
    return player;
  };

  /** Opens a real-money session; returns the token and the provider's game id from the URL. */
  const launch = async (player: Player, game = slot) => {
    const { body } = await http()
      .post(`/api/casino/games/${game}/sessions`)
      .set(player.headers)
      .send({ locale: 'en' })
      .expect(200);
    const url = new URL(body.url as string);
    return {
      token: url.searchParams.get('session')!,
      externalId: decodeURIComponent(url.pathname.split('/').at(-1)!),
    };
  };

  /** A provider call: exact body bytes, signed with the shared secret. */
  const call = (
    operation: GameWalletOperation,
    payload: object,
    secret = E2E_ENV.GAME_WALLET_SECRET,
  ) => {
    const body = JSON.stringify(payload);
    return http()
      .post(`/api/game-wallet/${operation}`)
      .set('content-type', 'application/json')
      .set(GAME_WALLET_SIGNATURE_HEADER, createHmac('sha256', secret).update(body).digest('hex'))
      .send(body);
  };
  const bet = (
    sessionToken: string,
    amount: number,
    transactionId = id('bet'),
    roundId = id('round'),
  ) => call('bet', { sessionToken, transactionId, roundId, amount, currency: 'GEL' });
  const win = (sessionToken: string, amount: number, roundId: string, transactionId = id('win')) =>
    call('win', { sessionToken, transactionId, roundId, amount, currency: 'GEL' });
  const balance = async (player: Player) =>
    (await http().get('/api/wallet').set(player.headers).expect(200)).body.balance as number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.get(CasinoSyncService).sync();
    const casino = ctx.app.get(CasinoService);
    slot = (
      await casino.listGames({
        type: 'slot',
        provider: 'golden-fleece-studios',
        page: 1,
        pageSize: 1,
      })
    ).items[0]!.slug;
    crash = (
      await casino.listGames({ type: 'crash', provider: 'red-rocket', page: 1, pageSize: 1 })
    ).items[0]!.slug;
  });
  afterAll(() => ctx?.app.close());

  it('opens real-money sessions only for signed-in players and real-money games', async () => {
    await http().post(`/api/casino/games/${slot}/sessions`).send({ locale: 'en' }).expect(401);
    const player = await signUp();
    await http()
      .post(`/api/casino/games/${crash}/sessions`)
      .set(player.headers)
      .send({ locale: 'en' })
      .expect(400);
    expect((await http().get(`/api/casino/games/${slot}`).expect(200)).body.hasRealMoney).toBe(
      true,
    );
    expect((await launch(player)).token).toMatch(/^[\w-]{43}$/);
  });

  it('refuses unsigned, mis-signed and malformed calls and unknown sessions', async () => {
    await http().post('/api/game-wallet/balance').send({ sessionToken: 'x' }).expect(401);
    expect(
      (await call('balance', { sessionToken: 'x' }, 'wrong-secret').expect(401)).body.code,
    ).toBe('INVALID_SIGNATURE');
    expect((await call('bet', { sessionToken: 'x' }).expect(400)).body.code).toBe(
      'INVALID_REQUEST',
    );
    expect((await call('balance', { sessionToken: 'nope' }).expect(404)).body.code).toBe(
      'SESSION_NOT_FOUND',
    );
  });

  it('takes bets, pays wins, closes the round and reports real bets to promotions', async () => {
    const player = await signUp(100_00);
    const { token } = await launch(player);
    expect((await call('balance', { sessionToken: token }).expect(200)).body).toEqual({
      balance: 100_00,
      currency: 'GEL',
    });

    const roundId = id('round');
    const betId = id('bet');
    expect((await bet(token, 10_00, betId, roundId).expect(200)).body.balance).toBe(90_00);
    expect((await win(token, 25_00, roundId).expect(200)).body.balance).toBe(115_00);
    expect((await bet(token, 1_00, id('bet'), roundId).expect(409)).body.code).toBe('ROUND_CLOSED');

    const [round] = await ctx.db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.externalId, roundId));
    expect(round).toMatchObject({
      status: 'closed',
      betTotal: 10_00,
      winTotal: 25_00,
      playerId: player.id,
    });

    const { body } = await http().get('/api/wallet/transactions').set(player.headers).expect(200);
    expect((body as WalletTransactionsPage).items.slice(0, 2)).toMatchObject([
      { type: 'win', amount: 25_00, gameSlug: slot },
      { type: 'bet', amount: -10_00, gameSlug: slot },
    ]);
    const events = await ctx.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.id, `game:${betId}`));
    expect(events).toMatchObject([{ kind: 'casino.bet', playerId: player.id }]);
  });

  it('closes a lost round with a zero win without moving money', async () => {
    const player = await signUp(10_00);
    const { token } = await launch(player);
    const roundId = id('round');
    await bet(token, 4_00, id('bet'), roundId).expect(200);
    expect((await win(token, 0, roundId).expect(200)).body.balance).toBe(6_00);
    const [round] = await ctx.db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.externalId, roundId));
    expect(round).toMatchObject({ status: 'closed', winTotal: 0 });
  });

  it('applies a repeated transaction id once and refuses it for a different call', async () => {
    const player = await signUp(50_00);
    const { token } = await launch(player);
    const roundId = id('round');
    const betId = id('bet');
    await bet(token, 5_00, betId, roundId).expect(200);
    expect((await bet(token, 5_00, betId, roundId).expect(200)).body.balance).toBe(45_00);
    expect((await bet(token, 6_00, betId, roundId).expect(409)).body.code).toBe(
      'DUPLICATE_TRANSACTION',
    );

    const winId = id('win');
    await win(token, 8_00, roundId, winId).expect(200);
    expect((await win(token, 8_00, roundId, winId).expect(200)).body.balance).toBe(53_00);
    expect(await balance(player)).toBe(53_00);
  });

  it('refuses bets over the balance and never overspends when bets race', async () => {
    const player = await signUp(100_00);
    const { token } = await launch(player);
    expect((await bet(token, 100_01).expect(402)).body.code).toBe('INSUFFICIENT_FUNDS');

    const results = await Promise.all(Array.from({ length: 5 }, () => bet(token, 30_00)));
    expect(results.map((res) => res.status).toSorted()).toEqual([200, 200, 200, 402, 402]);
    expect(await balance(player)).toBe(10_00);
  });

  it('rolls back a bet once, and refuses a bet that arrives after its rollback', async () => {
    const player = await signUp(20_00);
    const { token } = await launch(player);
    const roundId = id('round');
    const betId = id('bet');
    await bet(token, 15_00, betId, roundId).expect(200);

    const rollback = (rollbackOf: string, transactionId = id('rollback')) =>
      call('rollback', { sessionToken: token, transactionId, roundId, rollbackOf });
    expect((await rollback(betId).expect(200)).body.balance).toBe(20_00);
    expect((await rollback(betId).expect(200)).body.balance).toBe(20_00); // second rollback: no-op
    const [round] = await ctx.db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.externalId, roundId));
    expect(round!.betTotal).toBe(0);

    const lateBet = id('bet');
    await rollback(lateBet).expect(200);
    expect((await bet(token, 1_00, lateBet).expect(409)).body.code).toBe('TRANSACTION_ROLLED_BACK');
    expect(await balance(player)).toBe(20_00);
  });

  it('refuses new bets on an expired session but still pays wins', async () => {
    const player = await signUp(10_00);
    const { token } = await launch(player);
    const roundId = id('round');
    await bet(token, 2_00, id('bet'), roundId).expect(200);
    await ctx.db
      .update(casinoGameSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(casinoGameSessions.playerId, player.id));

    expect((await bet(token, 1_00).expect(403)).body.code).toBe('SESSION_EXPIRED');
    expect((await win(token, 5_00, roundId).expect(200)).body.balance).toBe(13_00);
  });

  it('plays the mock slot for real money through the signed wallet API', async () => {
    // The studio's client normally reaches us over the network; here it calls the test server.
    const client = ctx.app
      .select(CasinoModule)
      .get(GameWalletClient, { strict: true }) as unknown as {
      send: (path: string, body: string, headers: Record<string, string>) => Promise<RawResponse>;
    };
    const send = vi.spyOn(client, 'send').mockImplementation(async (path, body, headers) => {
      const res = await http().post(`/api/game-wallet${path}`).set(headers).send(body);
      return { status: res.status, body: res.body };
    });

    const player = await signUp(10_00);
    const { token, externalId } = await launch(player);
    const play = `/api/casino/mock/play/${encodeURIComponent(externalId)}`;
    expect(
      (await http().get(`${play}/balance`).query({ session: token }).expect(200)).body,
    ).toEqual({
      balance: 10_00,
    });

    const { body } = await http()
      .post(`${play}/spin`)
      .send({ session: token, bet: 5_00 })
      .expect(200);
    expect(body.reels).toHaveLength(3);
    expect(body.balance).toBe(10_00 - 5_00 + body.win);
    expect(await balance(player)).toBe(body.balance);

    await http().post(`${play}/spin`).send({ session: token, bet: 3_00 }).expect(400); // not offered
    expect(send).toHaveBeenCalledWith('/win', expect.any(String), expect.any(Object));
    send.mockRestore();
  });
});
