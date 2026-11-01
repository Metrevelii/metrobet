import type {
  AdminTradingEventDetail,
  AdminTradingEventsPage,
  AuditPage,
  EventLiability,
  EventLiabilitySummary,
} from '@metrobet/contracts';
import request from 'supertest';

import { SportsbookStore } from '../src/modules/sportsbook/sportsbook.store.js';
import { createTestApp } from './create-app.js';

type Headers = Record<string, string>;

describe('sportsbook trading (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let store: SportsbookStore;
  let risk: Headers;
  let player: Headers;
  const http = () => request(ctx.app.getHttpServer());

  /** An upcoming football match with an open 1X2 market. */
  const pickEvent = () =>
    store
      .overview('football')
      .upcoming.flatMap((group) => group.events)
      .map((summary) => store.event(summary.id)!)
      .find((event) => event.markets.some((m) => m.type === '1x2' && m.status === 'open'))!;
  const home = (eventId: string) => {
    const market = store.event(eventId)!.markets.find((m) => m.type === '1x2')!;
    return { market, selection: market.selections.find((s) => s.key === 'home')! };
  };
  const bet = (eventId: string, stake: number) => {
    const { selection } = home(eventId);
    return http()
      .post('/api/sportsbook/bets')
      .set(player)
      .send({
        idempotencyKey: crypto.randomUUID(),
        mode: 'single',
        selections: [{ selectionId: selection.id, odds: selection.odds }],
        stakes: [stake],
      });
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    store = ctx.app.get(SportsbookStore);
    for (let i = 0; i < 50 && store.sports().every((s) => s.upcomingCount === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    risk = await ctx.staffHeaders('risk');
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `trading-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    player = { authorization: `Bearer ${body.session.token}` };
    await http().post('/api/dev/wallet/deposit').set(player).send({ amount: 100_00 }).expect(200);
  });
  afterAll(() => ctx?.app.close());

  it('is for the risk role only', async () => {
    const support = await ctx.staffHeaders('support');
    await http().get('/api/admin/sportsbook/events').set(support).expect(403);
    await http().get('/api/admin/sportsbook/liability?eventIds=x').set(support).expect(403);
    const { body } = await http()
      .get('/api/admin/sportsbook/events')
      .query({ sport: 'football' })
      .set(risk)
      .expect(200);
    expect((body as AdminTradingEventsPage).items.length).toBeGreaterThan(0);
  });

  it('suspends a market for players at once, and resumes it, with an audit trail', async () => {
    const event = pickEvent();
    const { market } = home(event.id);
    const input = { scope: 'market', targetId: market.id, reason: 'Team news check' };

    const { body: suspension } = await http()
      .post('/api/admin/sportsbook/suspensions')
      .set(risk)
      .send(input)
      .expect(200);
    expect(suspension).toMatchObject({ targetId: market.id, eventId: event.id });
    expect(home(event.id).market.status).toBe('suspended');
    expect((await bet(event.id, 1_00)).body.code).toBe('SELECTION_UNAVAILABLE');

    const { body: detail } = await http()
      .get(`/api/admin/sportsbook/events/${event.id}`)
      .set(risk)
      .expect(200);
    expect((detail as AdminTradingEventDetail).suspensions).toMatchObject([
      { targetId: market.id, reason: 'Team news check' },
    ]);

    await http()
      .post('/api/admin/sportsbook/suspensions/resume')
      .set(risk)
      .send({ ...input, reason: 'All clear' })
      .expect(204);
    expect(home(event.id).market.status).toBe('open');
    await http().post('/api/admin/sportsbook/suspensions/resume').set(risk).send(input).expect(404);

    const { body: audit } = await http()
      .get('/api/admin/audit-log')
      .query({ entityType: 'sportsbook_market', entityId: market.id })
      .set(risk)
      .expect(200);
    expect((audit as AuditPage).items.map((item) => item.action)).toEqual([
      'sportsbook.resume',
      'sportsbook.suspend',
    ]);
  });

  it('applies competition margin and limits, and reports liability', async () => {
    const event = pickEvent();
    const key = event.competition.id;
    const feedHome = home(event.id).selection.odds;

    await http()
      .put('/api/admin/sportsbook/rules')
      .set(risk)
      .send({ scope: 'competition', key, margin: 2, maxStake: 3_00, maxPayout: null })
      .expect(200);
    const { market, selection } = home(event.id);
    const overround = market.selections.reduce((sum, s) => sum + 1 / s.odds, 0);
    expect(overround).toBeCloseTo(1.02, 1);
    expect(selection.odds).toBeGreaterThanOrEqual(feedHome);
    expect((await bet(event.id, 5_00)).body.code).toBe('STAKE_TOO_HIGH');

    // Other suites may have tickets on this match too: compare before and after our bet.
    const summary = async () =>
      (
        await http()
          .get('/api/admin/sportsbook/liability')
          .query({ eventIds: event.id })
          .set(risk)
          .expect(200)
      ).body[0] as EventLiabilitySummary;
    const homeRow = async () => {
      const { body } = await http()
        .get(`/api/admin/sportsbook/liability/${event.id}`)
        .set(risk)
        .expect(200);
      const market1x2 = (body as EventLiability).markets.find((m) => m.marketId === market.id);
      return {
        stake: market1x2?.stake ?? 0,
        row: market1x2?.selections.find((s) => s.selectionId === selection.id),
      };
    };
    const before = await summary();
    const beforeRow = await homeRow();
    const { body: placed } = await bet(event.id, 3_00).expect(200);
    const after = await summary();
    expect(after.tickets - before.tickets).toBe(1);
    expect(after.stake - before.stake).toBe(3_00);
    const { stake, row } = await homeRow();
    expect(stake - beforeRow.stake).toBe(3_00);
    expect(row!.singles.payout - (beforeRow.row?.singles.payout ?? 0)).toBe(
      placed.tickets[0].potentialWin,
    );
    expect(row!.net).toBe(stake - row!.singles.payout - row!.combos.payout);

    await http()
      .delete(`/api/admin/sportsbook/rules/competition/${encodeURIComponent(key)}`)
      .set(risk)
      .expect(204);
    const { body: detail } = await http()
      .get(`/api/admin/sportsbook/events/${event.id}`)
      .set(risk)
      .expect(200);
    const cleared = detail as AdminTradingEventDetail;
    expect(cleared.trading.margin).toBeNull();
    expect(home(event.id).selection.odds).toBe(cleared.feedOdds[home(event.id).selection.id]);
  });
});
