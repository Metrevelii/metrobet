import type {
  PlaceBetsRequest,
  PlaceBetsResponse,
  Selection,
  TicketsPage,
} from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { activityEvents } from '../src/modules/activity/activity.schema.js';
import { betTickets } from '../src/modules/betting/betting.schema.js';
import { SettlementService } from '../src/modules/betting/settlement.service.js';
import { SportsbookStore } from '../src/modules/sportsbook/sportsbook.store.js';
import { createTestApp } from './create-app.js';

type Player = { headers: Record<string, string> };
type Pick = Selection & { eventId: string };

const final = (home: number, away: number) => ({
  period: 'FT',
  clock: null,
  score: { home, away },
  periodScores: [],
});

const single = (pick: Pick, stake: number) => ({
  mode: 'single' as const,
  selections: [{ selectionId: pick.id, odds: pick.odds }],
  stakes: [stake],
});
const combo = (x: Pick, y: Pick) => ({
  mode: 'combo' as const,
  selections: [x, y].map((pick) => ({ selectionId: pick.id, odds: pick.odds })),
  stakes: [5_00],
});

describe('sportsbook betting (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let store: SportsbookStore;
  let settlement: SettlementService;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (deposit: number): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `bets-${crypto.randomUUID()}@example.com`,
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
    return { headers };
  };
  const balance = async (player: Player) =>
    (await http().get('/api/wallet').set(player.headers).expect(200)).body.balance as number;
  /** Home-win selections of upcoming football matches with open markets, one per event. */
  const homeWins = (count: number): Pick[] => {
    const picks = store
      .overview('football')
      .upcoming.flatMap((group) => group.events)
      .flatMap((summary) => {
        const event = store.event(summary.id);
        const market = event?.markets.find((item) => item.type === '1x2' && item.status === 'open');
        const home = market?.selections.find((item) => item.key === 'home' && item.active);
        return home ? [{ ...home, eventId: summary.id }] : [];
      })
      .slice(0, count);
    if (picks.length < count) throw new Error('Not enough open football markets in the feed');
    return picks;
  };
  const bet = (
    player: Player,
    body: Omit<PlaceBetsRequest, 'idempotencyKey'> & { idempotencyKey?: string },
  ) =>
    http()
      .post('/api/sportsbook/bets')
      .set(player.headers)
      .send({ idempotencyKey: crypto.randomUUID(), ...body });

  const status = async (id: string) =>
    (await ctx.db.select().from(betTickets).where(eq(betTickets.id, id)))[0]!.status;

  beforeAll(async () => {
    ctx = await createTestApp();
    store = ctx.app.get(SportsbookStore);
    settlement = ctx.app.get(SettlementService);
    // The simulated feed fills the store on its first tick.
    for (let i = 0; i < 50 && store.sports().every((s) => s.upcomingCount === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
  afterAll(() => ctx?.app.close());

  it('needs a player session', async () => {
    await http().get('/api/sportsbook/bets').expect(401);
    await http().post('/api/sportsbook/bets').send({}).expect(401);
  });

  it('places a single, debits the stake once and replays the same request', async () => {
    const player = await signUp(50_00);
    const [pick] = homeWins(1);
    const idempotencyKey = crypto.randomUUID();
    const first = await bet(player, { ...single(pick!, 10_00), idempotencyKey }).expect(200);
    const placed = first.body as PlaceBetsResponse;
    expect(placed.balance).toBe(40_00);
    expect(placed.tickets).toMatchObject([
      {
        mode: 'single',
        stake: 10_00,
        odds: pick!.odds,
        status: 'open',
        selections: [
          { selectionId: pick!.id, marketType: '1x2', selectionKey: 'home', result: null },
        ],
      },
    ]);

    const again = await bet(player, { ...single(pick!, 10_00), idempotencyKey }).expect(200);
    expect(again.body.tickets[0].id).toBe(placed.tickets[0]!.id);
    expect(await balance(player)).toBe(40_00);

    const { body } = await http()
      .get('/api/sportsbook/bets?status=open')
      .set(player.headers)
      .expect(200);
    expect((body as TicketsPage).total).toBe(1);
    const [event] = await ctx.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.id, `sportsbook:${placed.tickets[0]!.id}`));
    expect(event).toMatchObject({ kind: 'sports.bet' });
  });

  it('places one ticket per selection in single mode', async () => {
    const player = await signUp(50_00);
    const picks = homeWins(2);
    const { body } = await bet(player, {
      mode: 'single',
      selections: picks.map((pick) => ({ selectionId: pick.id, odds: pick.odds })),
      stakes: [3_00, 2_00],
    }).expect(200);
    expect((body as PlaceBetsResponse).tickets.map((ticket) => ticket.stake)).toEqual([3_00, 2_00]);
    expect(body.balance).toBe(45_00);
  });

  it('refuses lower odds, takes higher odds, and reports the current price', async () => {
    const player = await signUp(20_00);
    const [pick] = homeWins(1);
    const lower = await bet(player, {
      mode: 'single',
      selections: [{ selectionId: pick!.id, odds: pick!.odds + 0.5 }],
      stakes: [1_00],
    }).expect(409);
    expect(lower.body).toMatchObject({
      code: 'ODDS_CHANGED',
      selections: [{ selectionId: pick!.id, odds: pick!.odds }],
    });

    const higher = {
      mode: 'single' as const,
      selections: [{ selectionId: pick!.id, odds: 1.01 }],
      stakes: [1_00],
    };
    expect((await bet(player, higher).expect(200)).body.tickets[0].odds).toBe(pick!.odds);
    expect((await bet(player, { ...higher, acceptHigherOdds: false }).expect(409)).body.code).toBe(
      'ODDS_CHANGED',
    );
  });

  it('refuses unknown selections, same-event combos, bad stakes and missing funds', async () => {
    const player = await signUp(5_00);
    const [a, b] = homeWins(2);
    const unknown = await bet(player, {
      mode: 'single',
      selections: [{ selectionId: 'nope:1x2:-:home', odds: 2 }],
      stakes: [1_00],
    }).expect(409);
    expect(unknown.body).toMatchObject({ code: 'SELECTION_UNAVAILABLE' });

    const event = store.event(a!.eventId)!;
    const draw = event.markets.find((m) => m.type === 'double_chance')?.selections[0];
    if (draw) {
      const sameEvent = await bet(player, {
        mode: 'combo',
        selections: [
          { selectionId: a!.id, odds: a!.odds },
          { selectionId: draw.id, odds: draw.odds },
        ],
        stakes: [1_00],
      }).expect(400);
      expect(sameEvent.body.code).toBe('SAME_EVENT');
    }
    expect((await bet(player, single(a!, 5)).expect(400)).body.code).toBe('STAKE_TOO_LOW');
    expect((await bet(player, single(a!, 1000_01)).expect(400)).body.code).toBe('STAKE_TOO_HIGH');
    expect((await bet(player, single(b!, 6_00)).expect(402)).body.code).toBe('INSUFFICIENT_FUNDS');
    expect(await balance(player)).toBe(5_00);
  });

  it('settles a won single and pays stake × odds', async () => {
    const player = await signUp(10_00);
    const [pick] = homeWins(1);
    const { body } = await bet(player, single(pick!, 4_00)).expect(200);
    const ticket = (body as PlaceBetsResponse).tickets[0]!;

    await settlement.settleEvent({ eventId: pick!.eventId, sport: 'football', final: final(2, 0) });
    const [row] = await ctx.db.select().from(betTickets).where(eq(betTickets.id, ticket.id));
    expect(row).toMatchObject({ status: 'won', payout: Math.floor(4_00 * pick!.odds) });
    expect(await balance(player)).toBe(6_00 + Math.floor(4_00 * pick!.odds));

    // Settling again changes nothing.
    await settlement.settleEvent({ eventId: pick!.eventId, sport: 'football', final: final(0, 3) });
    await settlement.settleTicket(ticket.id);
    expect(await balance(player)).toBe(6_00 + Math.floor(4_00 * pick!.odds));
  });

  it('loses a combo as soon as one leg loses, and pays a combo whose legs all win', async () => {
    const player = await signUp(20_00);
    const [a, b, c, d] = homeWins(4);
    const lost = (await bet(player, combo(a!, b!)).expect(200)).body.tickets[0];
    const won = (await bet(player, combo(c!, d!)).expect(200)).body.tickets[0];
    expect(lost.odds).toBe(Math.floor(a!.odds * b!.odds * 100 + 1e-6) / 100);

    await settlement.settleEvent({ eventId: a!.eventId, sport: 'football', final: final(0, 1) });
    expect(await status(lost.id)).toBe('lost'); // b is still open

    await settlement.settleEvent({ eventId: c!.eventId, sport: 'football', final: final(1, 0) });
    expect(await status(won.id)).toBe('open');
    await settlement.settleEvent({ eventId: d!.eventId, sport: 'football', final: final(3, 2) });
    expect(await status(won.id)).toBe('won');
    expect(await balance(player)).toBe(
      10_00 + Math.floor((5_00 * Math.round(won.odds * 100)) / 100),
    );

    const { body } = await http()
      .get('/api/sportsbook/bets?status=settled')
      .set(player.headers)
      .expect(200);
    expect((body as TicketsPage).items.map((ticket) => ticket.status).toSorted()).toEqual([
      'lost',
      'won',
    ]);
  });

  it('places a request once when it is submitted twice at the same time', async () => {
    const player = await signUp(10_00);
    const [pick] = homeWins(1);
    const idempotencyKey = crypto.randomUUID();
    const results = await Promise.all(
      [0, 1].map(() => bet(player, { ...single(pick!, 4_00), idempotencyKey })),
    );
    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(results[0]!.body.tickets[0].id).toBe(results[1]!.body.tickets[0].id);
    expect(await balance(player)).toBe(6_00);
  });
});
