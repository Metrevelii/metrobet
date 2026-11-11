import { createHmac } from 'node:crypto';

import {
  GAME_WALLET_SIGNATURE_HEADER,
  type LimitKind,
  type LimitPeriod,
  type ResponsibleGaming,
} from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { CasinoService } from '../src/modules/casino/casino.service.js';
import { players } from '../src/modules/players/players.schema.js';
import { createTestApp } from './create-app.js';
import { E2E_ENV } from './e2e-env.js';

const PASSWORD = 'Str0ng!Passw0rd';

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const limitOf = (body: ResponsibleGaming, kind: LimitKind, period: LimitPeriod) =>
  body.limits.find((limit) => limit.kind === kind && limit.period === period)!;

describe('responsible gaming and account security (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let slot: string;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async () => {
    const identifier = `rg-${crypto.randomUUID()}@example.com`;
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier,
        password: PASSWORD,
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    return { id: body.player.id as string, identifier, headers: auth(body.session.token) };
  };
  const login = (identifier: string, password = PASSWORD) =>
    http().post('/api/auth/login').send({ identifier, password });
  const deposit = (headers: Record<string, string>, amount: number) =>
    http().post('/api/dev/wallet/deposit').set(headers).send({ amount });
  const setLimit = (headers: Record<string, string>, body: object) =>
    http().put('/api/responsible-gaming/limits').set(headers).send(body).expect(200);

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.get(CasinoSyncService).sync();
    slot = (
      await ctx.app.get(CasinoService).listGames({
        type: 'slot',
        provider: 'golden-fleece-studios',
        page: 1,
        pageSize: 1,
      })
    ).items[0]!.slug;
  });
  afterAll(() => ctx?.app.close());

  it('applies a deposit limit at once and delays a raise by a day', async () => {
    const player = await signUp();
    const set = await setLimit(player.headers, { kind: 'deposit', period: 'day', amount: 100_00 });
    expect(limitOf(set.body, 'deposit', 'day')).toMatchObject({
      amount: 100_00,
      used: 0,
      pending: null,
    });

    await deposit(player.headers, 60_00).expect(200);
    const refused = await deposit(player.headers, 50_00).expect(403);
    expect(refused.body).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      limit: { kind: 'deposit', period: 'day', remaining: 40_00 },
    });

    const raised = await setLimit(player.headers, {
      kind: 'deposit',
      period: 'day',
      amount: 500_00,
    });
    const limit = limitOf(raised.body, 'deposit', 'day');
    expect(limit).toMatchObject({ amount: 100_00, used: 60_00, pending: { amount: 500_00 } });
    expect(Date.parse(limit.pending!.effectiveAt) - Date.now()).toBeGreaterThan(23 * 3600_000);
    await deposit(player.headers, 50_00).expect(403);
    await deposit(player.headers, 40_00).expect(200);
  });

  it('refuses game bets above a stake limit with LIMIT_EXCEEDED', async () => {
    const player = await signUp();
    await deposit(player.headers, 100_00).expect(200);
    await setLimit(player.headers, { kind: 'stake', period: 'day', amount: 10_00 });
    const { body } = await http()
      .post(`/api/casino/games/${slot}/sessions`)
      .set(player.headers)
      .send({ locale: 'en' })
      .expect(200);
    const sessionToken = new URL(body.url as string).searchParams.get('session')!;
    const bet = (amount: number) => {
      const payload = JSON.stringify({
        sessionToken,
        transactionId: `rg-${crypto.randomUUID()}`,
        roundId: `rg-${crypto.randomUUID()}`,
        amount,
        currency: 'GEL',
      });
      return http()
        .post('/api/game-wallet/bet')
        .set('content-type', 'application/json')
        .set(
          GAME_WALLET_SIGNATURE_HEADER,
          createHmac('sha256', E2E_ENV.GAME_WALLET_SECRET).update(payload).digest('hex'),
        )
        .send(payload);
    };
    await bet(6_00).expect(200);
    expect((await bet(5_00).expect(403)).body.code).toBe('LIMIT_EXCEEDED');
    await bet(4_00).expect(200);
    const overview = await http().get('/api/responsible-gaming').set(player.headers).expect(200);
    expect(limitOf(overview.body, 'stake', 'day').used).toBe(10_00);
    expect(limitOf(overview.body, 'loss', 'day')).toMatchObject({ amount: null, used: 10_00 });
  });

  it('saves the reality check and summarises play since a moment', async () => {
    const player = await signUp();
    await http()
      .put('/api/responsible-gaming/reality-check')
      .set(player.headers)
      .send({ minutes: 45 })
      .expect(400);
    await http()
      .put('/api/responsible-gaming/reality-check')
      .set(player.headers)
      .send({ minutes: 30 })
      .expect(200);
    expect(
      (await http().get('/api/responsible-gaming/reality-check').set(player.headers).expect(200))
        .body,
    ).toEqual({ minutes: 30 });
    const since = new Date(Date.now() - 60_000).toISOString();
    const activity = await http()
      .get('/api/responsible-gaming/activity')
      .query({ since })
      .set(player.headers)
      .expect(200);
    expect(activity.body).toMatchObject({ stakes: 0, returns: 0, net: 0 });
    await http()
      .get('/api/responsible-gaming/activity')
      .query({ since: new Date(Date.now() - 2 * 86_400_000).toISOString() })
      .set(player.headers)
      .expect(400);
  });

  it('lists sessions, signs out other devices and changes the password', async () => {
    const player = await signUp();
    const other = auth((await login(player.identifier).expect(200)).body.session.token);
    const { body: list } = await http().get('/api/auth/sessions').set(player.headers).expect(200);
    expect(list).toHaveLength(2);
    expect(list.filter((session: { current: boolean }) => session.current)).toHaveLength(1);

    await http().post('/api/auth/sessions/revoke-others').set(player.headers).expect(204);
    await http().get('/api/auth/me').set(other).expect(401);

    await http()
      .post('/api/auth/password/change')
      .set(player.headers)
      .send({ currentPassword: 'wrong-pass1', password: 'N3wPassword!' })
      .expect(403);
    const third = auth((await login(player.identifier).expect(200)).body.session.token);
    await http()
      .post('/api/auth/password/change')
      .set(player.headers)
      .send({ currentPassword: PASSWORD, password: 'N3wPassword!' })
      .expect(204);
    await http().get('/api/auth/me').set(third).expect(401);
    await http().get('/api/auth/me').set(player.headers).expect(200);
    await login(player.identifier).expect(401);
    await login(player.identifier, 'N3wPassword!').expect(200);

    const { body: sessions } = await http().get('/api/auth/sessions').set(player.headers);
    const latest = (sessions as { id: string; current: boolean }[]).find((s) => !s.current)!;
    await http().post(`/api/auth/sessions/${latest.id}/revoke`).set(player.headers).expect(204);
    await http().post(`/api/auth/sessions/${latest.id}/revoke`).set(player.headers).expect(404);
    await http().get('/api/auth/me').set(player.headers).expect(200);
  });

  it('takes a break: signs out, blocks login until the end, then reactivates', async () => {
    const player = await signUp();
    await http()
      .post('/api/responsible-gaming/exclusion')
      .set(player.headers)
      .send({ period: '1d', password: 'wrong-pass1' })
      .expect(403);
    await http()
      .post('/api/responsible-gaming/exclusion')
      .set(player.headers)
      .send({ period: '1d', password: PASSWORD })
      .expect(204);
    await http().get('/api/auth/me').set(player.headers).expect(401);
    await login(player.identifier).expect(403);

    const support = await ctx.staffHeaders('support');
    const { body: admin } = await http()
      .get(`/api/admin/players/${player.id}`)
      .set(support)
      .expect(200);
    expect(admin.status).toBe('self_excluded');
    expect(Date.parse(admin.excludedUntil) - Date.now()).toBeGreaterThan(23 * 3600_000);
    await http().get(`/api/admin/players/${player.id}/responsible-gaming`).set(support).expect(200);

    // The break is over.
    await ctx.db
      .update(players)
      .set({ excludedUntil: new Date(Date.now() - 1000) })
      .where(eq(players.id, player.id));
    const { body } = await login(player.identifier).expect(200);
    expect(body.player.status).toBe('active');
  });

  it('a permanent self-exclusion keeps the account closed', async () => {
    const player = await signUp();
    await http()
      .post('/api/responsible-gaming/exclusion')
      .set(player.headers)
      .send({ period: 'permanent', password: PASSWORD })
      .expect(204);
    await login(player.identifier).expect(403);
  });
});
