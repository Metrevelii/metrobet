import type {
  AdminPlayersPage,
  AdminTicket,
  AuditPage,
  Dashboard,
  PlaceBetsResponse,
} from '@metrobet/contracts';
import request from 'supertest';

import { SportsbookStore } from '../src/modules/sportsbook/sportsbook.store.js';
import { createTestApp } from './create-app.js';

type Headers = Record<string, string>;

describe('backoffice admin API (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let store: SportsbookStore;
  let support: Headers;
  let risk: Headers;
  let finance: Headers;
  let marketing: Headers;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (deposit: number) => {
    const email = `admin-${crypto.randomUUID()}@example.com`;
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: email,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    const headers = { authorization: `Bearer ${body.session.token}` };
    if (deposit) {
      await http()
        .post('/api/dev/wallet/deposit')
        .set(headers)
        .send({ amount: deposit })
        .expect(200);
    }
    return { id: body.player.id as string, email, headers };
  };
  const balance = async (headers: Headers) =>
    (await http().get('/api/wallet').set(headers).expect(200)).body.balance as number;
  /** Home-win selections of upcoming football matches, one per event. */
  const homeWins = (count: number) =>
    store
      .overview('football')
      .upcoming.flatMap((group) => group.events)
      .flatMap((summary) => {
        const market = store
          .event(summary.id)
          ?.markets.find((item) => item.type === '1x2' && item.status === 'open');
        const home = market?.selections.find((item) => item.key === 'home' && item.active);
        return home ? [home] : [];
      })
      .slice(0, count);
  const placeBet = async (
    headers: Headers,
    mode: 'single' | 'combo',
    count: number,
    stake: number,
  ) => {
    const picks = homeWins(count);
    const { body } = await http()
      .post('/api/sportsbook/bets')
      .set(headers)
      .send({
        idempotencyKey: crypto.randomUUID(),
        mode,
        selections: picks.map((pick) => ({ selectionId: pick.id, odds: pick.odds })),
        stakes: mode === 'combo' ? [stake] : picks.map(() => stake),
      })
      .expect(200);
    return (body as PlaceBetsResponse).tickets[0]!;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    store = ctx.app.get(SportsbookStore);
    for (let i = 0; i < 50 && store.sports().every((s) => s.upcomingCount === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    support = await ctx.staffHeaders('support');
    risk = await ctx.staffHeaders('risk');
    finance = await ctx.staffHeaders('finance');
    marketing = await ctx.staffHeaders('marketing');
  });
  afterAll(() => ctx?.app.close());

  it('lets support find a player, but not marketing or players', async () => {
    const player = await signUp(12_00);
    const { body } = await http()
      .get('/api/admin/players')
      .query({ search: player.email.slice(0, 20) })
      .set(support)
      .expect(200);
    expect((body as AdminPlayersPage).items).toMatchObject([
      { id: player.id, email: player.email, status: 'active', balance: 12_00 },
    ]);
    await http().get(`/api/admin/players/${player.id}`).set(finance).expect(200);
    await http().get('/api/admin/players').set(marketing).expect(403);
    await http().get('/api/admin/players').set(player.headers).expect(401);
    await http().get(`/api/admin/players/${player.id}/transactions`).set(support).expect(200);
    await http().get(`/api/admin/players/${player.id}/rounds`).set(support).expect(200);
  });

  it('suspends a player (signing them out everywhere) and logs who did it', async () => {
    const player = await signUp(0);
    await http()
      .patch(`/api/admin/players/${player.id}/status`)
      .set(finance)
      .send({ status: 'suspended', reason: 'Fraud check' })
      .expect(403);
    await http()
      .patch(`/api/admin/players/${player.id}/status`)
      .set(support)
      .send({ status: 'suspended', reason: 'x' })
      .expect(400); // reason too short
    const { body } = await http()
      .patch(`/api/admin/players/${player.id}/status`)
      .set(support)
      .send({ status: 'suspended', reason: 'Fraud check' })
      .expect(200);
    expect(body.status).toBe('suspended');
    await http().get('/api/wallet').set(player.headers).expect(401);

    const audit = await http()
      .get('/api/admin/audit-log')
      .query({ entityType: 'player', entityId: player.id })
      .set(risk)
      .expect(200);
    expect((audit.body as AuditPage).items).toMatchObject([
      {
        action: 'player.status',
        actorName: 'E2E support',
        before: { status: 'active' },
        after: { status: 'suspended', reason: 'Fraud check' },
      },
    ]);
    await http().get('/api/admin/audit-log').set(support).expect(403);
  });

  it('lets risk void an open ticket, refunding the stake once', async () => {
    const player = await signUp(20_00);
    const ticket = await placeBet(player.headers, 'single', 1, 5_00);
    const list = await http()
      .get('/api/admin/bets')
      .query({ playerId: player.id, status: 'open' })
      .set(finance)
      .expect(200);
    expect(list.body.items).toMatchObject([{ id: ticket.id, player: { email: player.email } }]);

    await http()
      .post(`/api/admin/bets/${ticket.id}/void`)
      .set(finance)
      .send({ reason: 'Palpable error' })
      .expect(403);
    const { body } = await http()
      .post(`/api/admin/bets/${ticket.id}/void`)
      .set(risk)
      .send({ reason: 'Palpable error' })
      .expect(200);
    expect(body as AdminTicket).toMatchObject({ status: 'void', payout: 5_00 });
    expect(await balance(player.headers)).toBe(20_00);
    await http()
      .post(`/api/admin/bets/${ticket.id}/void`)
      .set(risk)
      .send({ reason: 'Again please' })
      .expect(409);
    expect(await balance(player.headers)).toBe(20_00);
  });

  it('settles selections by hand, settling the ticket once its outcome is known', async () => {
    const player = await signUp(20_00);
    const ticket = await placeBet(player.headers, 'combo', 2, 4_00);
    const [first, second] = ticket.selections;
    const settle = (selectionId: string, result: string) =>
      http()
        .post(`/api/admin/bets/${ticket.id}/selections/${encodeURIComponent(selectionId)}/settle`)
        .set(risk)
        .send({ result, reason: 'Feed result missing' });

    expect((await settle(first!.selectionId, 'won').expect(200)).body.status).toBe('open');
    await settle(first!.selectionId, 'lost').expect(409); // already resolved
    const done = (await settle(second!.selectionId, 'void').expect(200)).body as AdminTicket;
    // Second leg void: paid at the first leg's odds.
    expect(done).toMatchObject({
      status: 'won',
      payout: Math.floor((4_00 * Math.round(first!.odds * 100)) / 100),
    });
    expect(await balance(player.headers)).toBe(16_00 + done.payout);
  });

  it("shows today's numbers on the dashboard", async () => {
    const player = await signUp(30_00);
    await placeBet(player.headers, 'single', 1, 3_00);
    const { body } = await http().get('/api/admin/dashboard').set(finance).expect(200);
    const dashboard = body as Dashboard;
    expect(dashboard.sportsbook.stakes).toBeGreaterThanOrEqual(3_00);
    expect(dashboard.sportsbook.bets).toBeGreaterThanOrEqual(1);
    expect(dashboard.deposits).toBeGreaterThanOrEqual(30_00);
    expect(dashboard.newPlayers).toBeGreaterThanOrEqual(1);
    expect(dashboard.activePlayers).toBeGreaterThanOrEqual(1);
    expect(dashboard.openTickets).toBeGreaterThanOrEqual(1);
    expect(dashboard.playerBalances).toBeGreaterThanOrEqual(27_00);
  });
});
