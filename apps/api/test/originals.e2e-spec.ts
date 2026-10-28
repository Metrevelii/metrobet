import type { AddressInfo } from 'node:net';

import {
  jetElapsedFor,
  JET_BETTING_MS,
  ORIGINALS_WS,
  ORIGINALS_WS_NAMESPACE,
  type OriginalsAck,
  parseOriginalLaunch,
  type SupraSpinResult,
} from '@metrobet/contracts';
import { ConfigService } from '@nestjs/config';
import { desc, eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import {
  GameWalletClient,
  type RawResponse,
} from '../src/common/game-wallet/game-wallet-client.js';
import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { gameRounds } from '../src/modules/game-wallet/game-wallet.schema.js';
import { crashPointFor, seedHash } from '../src/modules/originals/metro-jet/metro-jet-fairness.js';
import { jetBets, jetRounds } from '../src/modules/originals/metro-jet/metro-jet.schema.js';
import { MetroJetService } from '../src/modules/originals/metro-jet/metro-jet.service.js';
import { OriginalsModule } from '../src/modules/originals/originals.module.js';
import { OriginalsWallet } from '../src/modules/originals/wallet/originals-wallet.js';
import { createTestApp } from './create-app.js';

type Player = { headers: Record<string, string> };

/** Polls until `check` passes (settlements after auto cash-outs and crashes run in background). */
const eventually = async (check: () => Promise<void>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await check();
    } catch (error) {
      if (attempt > 40) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
};

describe('Metrobet Originals (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let jet: MetroJetService;
  let baseUrl: string;
  const sockets: Socket[] = [];
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (deposit: number): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `orig-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    const headers = { authorization: `Bearer ${body.session.token}` };
    await http().post('/api/dev/wallet/deposit').set(headers).send({ amount: deposit }).expect(200);
    return { headers };
  };
  const realSession = async (player: Player, game: string) => {
    const { body } = await http()
      .post(`/api/casino/games/${game}/sessions`)
      .set(player.headers)
      .send({ locale: 'en' })
      .expect(200);
    return parseOriginalLaunch(body.url as string)!;
  };
  const balance = async (player: Player) =>
    (await http().get('/api/wallet').set(player.headers).expect(200)).body.balance as number;
  const connect = (session: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`${baseUrl}${ORIGINALS_WS_NAMESPACE}`, {
        auth: { session },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      socket.once(ORIGINALS_WS.balance, () => resolve(socket));
      socket.once('disconnect', () => reject(new Error('disconnected')));
    });
  const currentRound = async () =>
    (await ctx.db.select().from(jetRounds).orderBy(desc(jetRounds.number)).limit(1))[0]!;

  /**
   * Starts betting rounds (finishing each) until one will fly at least to `min`. Returns it with
   * `now` = the moment its betting window opened (the test clock).
   */
  const roundReaching = async (min: number) => {
    await jet.advance(Date.now());
    for (;;) {
      const round = await currentRound();
      const now = jet.state(null)!.round.bettingEndsAt - JET_BETTING_MS;
      if (round.status === 'betting' && round.crashPoint >= min) return { round, now };
      const start = now + JET_BETTING_MS;
      await jet.advance(start);
      const crashedAt = start + jetElapsedFor(round.crashPoint) + 1;
      await jet.advance(crashedAt);
      await jet.advance(crashedAt + 60_000);
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
    await ctx.app.get(CasinoSyncService).sync();
    jet = ctx.app.get(MetroJetService);

    // The studio reaches the game wallet API over the network; in tests it calls this app.
    const client = ctx.app
      .select(OriginalsModule)
      .get(GameWalletClient, { strict: true }) as unknown as {
      send: (path: string, body: string, headers: Record<string, string>) => Promise<RawResponse>;
    };
    vi.spyOn(client, 'send').mockImplementation(async (path, body, headers) => {
      const res = await http().post(`/api/game-wallet${path}`).set(headers).send(body);
      return { status: res.status, body: res.body };
    });
  });
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await ctx?.app.close();
  });

  it('lists both Originals games with art, launching demo play natively', async () => {
    const { body } = await http().get('/api/casino/games?search=supra').expect(200);
    expect(body.items[0]).toMatchObject({
      slug: 'supra-fortune',
      provider: { name: 'Metrobet Originals' },
    });
    const art = await http().get('/api/originals/art/metro-jet.svg').expect(200);
    expect(art.headers['content-type']).toContain('image/svg+xml');

    const demo = await http()
      .post('/api/casino/games/metro-jet/launch')
      .send({ mode: 'demo', locale: 'en' })
      .expect(200);
    expect(parseOriginalLaunch(demo.body.url)).toMatchObject({ game: 'metro-jet', mode: 'demo' });
    expect(ctx.app.get(ConfigService).get('ORIGINALS_JET_LOOP')).toBe('off');
  });

  it('spins Supra Fortune for real money over the socket', async () => {
    const player = await signUp(10_00);
    const { session } = await realSession(player, 'supra-fortune');
    const socket = await connect(session);

    const ack = (await socket.emitWithAck(ORIGINALS_WS.supraSpin, {
      bet: 1_00,
    })) as OriginalsAck<SupraSpinResult>;
    if (!ack.ok) throw new Error(ack.code);
    expect(ack.data.stops).toHaveLength(5);
    expect(ack.data.win).toBe(ack.data.wins.reduce((sum, line) => sum + line.amount, 0));
    expect(ack.data.balance).toBe(10_00 - 1_00 + ack.data.win);
    expect(await balance(player)).toBe(ack.data.balance);

    const refused = (await socket.emitWithAck(ORIGINALS_WS.supraSpin, {
      bet: 3,
    })) as OriginalsAck<null>;
    expect(refused).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  });

  it('refuses sockets without a valid session', async () => {
    await expect(connect('not-a-session')).rejects.toThrow('disconnected');
  });

  it('runs a Metro Jet round: bets, auto and manual cash-outs, a provably fair crash', async () => {
    const alice = await signUp(100_00);
    const bob = await signUp(50_00);
    const a = (await realSession(alice, 'metro-jet')).session;
    const b = (await realSession(bob, 'metro-jet')).session;
    const { round, now } = await roundReaching(2);
    const start = now + JET_BETTING_MS;

    expect(await jet.placeBet(a, { slot: 0, amount: 10_00, autoCashout: null }, now + 100)).toEqual(
      {
        ok: true,
        data: null,
      },
    );
    expect((await jet.placeBet(a, { slot: 1, amount: 5_00, autoCashout: 1.5 }, now + 200)).ok).toBe(
      true,
    );
    expect(await jet.placeBet(a, { slot: 0, amount: 1_00, autoCashout: null }, now + 300)).toEqual({
      ok: false,
      code: 'ALREADY_BET',
    });
    expect(
      (await jet.placeBet(b, { slot: 0, amount: 60_00, autoCashout: null }, now + 300)).ok,
    ).toBe(false); // over balance
    expect(
      (await jet.placeBet(b, { slot: 0, amount: 20_00, autoCashout: null }, now + 400)).ok,
    ).toBe(true);
    expect((await jet.cancel(b, 0)).ok).toBe(true);
    expect(await balance(alice)).toBe(85_00);
    expect(await balance(bob)).toBe(50_00);
    expect((await jet.cashout(a, 0, now + 500)).ok).toBe(false); // not flying yet

    await jet.advance(start);
    expect(await jet.placeBet(b, { slot: 0, amount: 1_00, autoCashout: null }, start + 10)).toEqual(
      {
        ok: false,
        code: 'WRONG_PHASE',
      },
    );
    await jet.advance(start + jetElapsedFor(1.6)); // auto cash-out of slot 1 at exactly 1.50×
    const manual = await jet.cashout(a, 0, start + jetElapsedFor(1.8) + 1);
    if (!manual.ok) throw new Error(manual.code);
    expect(manual.data).toEqual({ multiplier: 1.8, win: 18_00 });

    await jet.advance(start + jetElapsedFor(round.crashPoint) + 1);
    const state = jet.state(null)!;
    expect(state.round).toMatchObject({ phase: 'crashed', crashPoint: round.crashPoint });
    expect(seedHash(state.round.seed!)).toBe(state.round.seedHash);
    expect(crashPointFor(state.round.seed!, state.round.number)).toBe(round.crashPoint);

    await eventually(async () => expect(await balance(alice)).toBe(85_00 + 7_50 + 18_00));
    const bets = await ctx.db.select().from(jetBets).where(eq(jetBets.roundId, round.id));
    expect(bets.filter((bet) => bet.status === 'cashed')).toHaveLength(2);
    expect(bets.every((bet) => bet.settled)).toBe(true);
  });

  it('closes lost bets with a zero win when the jet flies away', async () => {
    const player = await signUp(10_00);
    const { session } = await realSession(player, 'metro-jet');
    const { round, now } = await roundReaching(1);
    expect(
      (await jet.placeBet(session, { slot: 0, amount: 4_00, autoCashout: null }, now)).ok,
    ).toBe(true);
    await jet.advance(now + JET_BETTING_MS);
    await jet.advance(now + JET_BETTING_MS + jetElapsedFor(round.crashPoint) + 1);

    await eventually(async () => {
      const [bet] = await ctx.db.select().from(jetBets).where(eq(jetBets.roundId, round.id));
      expect(bet).toMatchObject({ status: 'lost', settled: true });
    });
    const [walletRound] = await ctx.db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.gameSlug, 'metro-jet'))
      .orderBy(desc(gameRounds.openedAt))
      .limit(1);
    expect(walletRound).toMatchObject({ status: 'closed', betTotal: 4_00, winTotal: 0 });
    expect(await balance(player)).toBe(6_00);
  });

  it('refunds bets of a round cut short by a restart', async () => {
    const player = await signUp(10_00);
    const { session } = await realSession(player, 'metro-jet');
    const { now } = await roundReaching(1);
    expect(
      (await jet.placeBet(session, { slot: 0, amount: 3_00, autoCashout: null }, now)).ok,
    ).toBe(true);
    expect(await balance(player)).toBe(7_00);

    // A fresh instance = the server after a restart: it voids the round and refunds the bet.
    const restarted = new MetroJetService(
      ctx.db,
      ctx.app.get(OriginalsWallet),
      ctx.app.get(ConfigService),
    );
    await restarted.onModuleInit();
    expect(await balance(player)).toBe(10_00);
    expect((await currentRound()).status).toBe('void');
  });
});
