import type { PromotionInput, WheelSpinResult, WheelState } from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { ActivityBus } from '../src/modules/activity/activity-bus.js';
import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { CasinoService } from '../src/modules/casino/casino.service.js';
import { promoRewards } from '../src/modules/promotions/rewards.schema.js';
import { createTestApp } from './create-app.js';

const text = (value: string) => ({ ka: `${value} ka`, en: `${value} en`, ru: `${value} ru` });
const STEP = 50_00; // 50 ₾ wagered = 1 spin

describe('promo wheel (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: Record<string, string>;
  let slot: string;
  let crash: string;
  const http = () => request(ctx.app.getHttpServer());

  const promotion = (blocks: PromotionInput['blocks']): PromotionInput => ({
    slug: 'wheel-promo',
    category: 'casino',
    title: text('title'),
    subtitle: text('subtitle'),
    ctaLabel: text('cta'),
    ctaHref: null,
    image: { desktop: '/d.svg', mobile: '/m.svg' },
    blocks,
    placements: ['casino'],
    isActive: true,
    startsAt: null,
    endsAt: null,
  });
  const wheel = (freeSpinsGame: string) => ({
    id: 'wheel',
    type: 'wheel' as const,
    title: text('wheel'),
    earn: { stepAmount: STEP, gameTypes: ['slot' as const] },
    freeSpinsGame,
    segments: [5, 10, 20, 50].map((freeSpins, i) => ({ freeSpins, weight: 4 - i })),
  });
  const optIn = { id: 'join', type: 'optIn' as const, title: text('join'), body: text('body') };

  const signUp = async () => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `wheel-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    return { authorization: `Bearer ${body.session.token}` };
  };
  const bet = (player: Record<string, string>, gameSlug: string, amount: number) =>
    http().post('/api/dev/activity/casino-bet').set(player).send({ gameSlug, amount }).expect(204);
  const state = async (player: Record<string, string>) =>
    (await http().get('/api/promotions/wheel-promo/wheels/wheel').set(player).expect(200))
      .body as WheelState;
  const spin = (player: Record<string, string>) =>
    http().post('/api/promotions/wheel-promo/wheels/wheel/spin').set(player);

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.staffHeaders('marketing');
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
  beforeEach(() => ctx.reset());
  afterAll(() => ctx?.app.close());

  const saveWheel = (game: string) =>
    http()
      .post('/api/admin/promotions')
      .set(admin)
      .send(promotion([wheel(game)]))
      .expect(400);

  it('only accepts an existing slot game for the free spins', async () => {
    expect((await saveWheel('no-such-game')).body.issues).toEqual([
      { path: 'blocks.0.freeSpinsGame', message: 'No game with this slug' },
    ]);
    expect((await saveWheel(crash)).body.issues[0].message).toBe('Free spins need a slot game');
  });

  it('turns wagers into spins and spins into free-spin rewards', async () => {
    await http()
      .post('/api/admin/promotions')
      .set(admin)
      .send(promotion([optIn, wheel(slot)]))
      .expect(201);
    const player = await signUp();

    // Before opt-in nothing counts and spinning is refused.
    await bet(player, slot, 100_00);
    expect(await state(player)).toMatchObject({ eligible: false, wagered: 0 });
    await spin(player).expect(403);

    await http().post('/api/promotions/wheel-promo/enrollment').set(player).expect(200);
    await bet(player, slot, 60_00);
    await bet(player, crash, 100_00); // wrong game type: ignored
    expect(await state(player)).toMatchObject({
      eligible: true,
      wagered: 60_00,
      spinsAvailable: 1,
      toNextSpin: 40_00,
    });

    const { body } = await spin(player).expect(200);
    const result = body as WheelSpinResult;
    expect([5, 10, 20, 50][result.segmentIndex]).toBe(result.freeSpins);
    expect(result.state).toMatchObject({ spinsAvailable: 0, spinsUsed: 1 });
    expect(result.state.wins).toEqual([{ freeSpins: result.freeSpins, wonAt: expect.any(String) }]);
    await spin(player).expect(409);

    const rewards = await ctx.db.select().from(promoRewards);
    expect(rewards).toMatchObject([{ source: 'wheel', kind: 'freeSpins', status: 'granted' }]);
    expect(rewards[0]!.payload).toEqual({ count: result.freeSpins, gameSlug: slot });
  });

  it('never spends more spins than earned, even when spins race', async () => {
    await http()
      .post('/api/admin/promotions')
      .set(admin)
      .send(promotion([wheel(slot)]));
    const player = await signUp();
    await bet(player, slot, 2 * STEP);

    const results = await Promise.all(Array.from({ length: 5 }, () => spin(player)));
    expect(results.map((res) => res.status).toSorted()).toEqual([200, 200, 409, 409, 409]);
    expect(await state(player)).toMatchObject({ spinsAvailable: 0, spinsUsed: 2 });
  });

  it('counts a re-delivered activity event once', async () => {
    await http()
      .post('/api/admin/promotions')
      .set(admin)
      .send(promotion([wheel(slot)]));
    const player = await signUp();
    const { body: me } = await http().get('/api/auth/me').set(player).expect(200);
    const event = {
      id: 'aggregator-tx-1',
      kind: 'casino.bet' as const,
      playerId: me.id as string,
      occurredAt: new Date().toISOString(),
      amount: STEP,
      currency: 'GEL' as const,
      gameSlug: slot,
      gameType: 'slot' as const,
    };
    const bus = ctx.app.get(ActivityBus);
    await expect(bus.publish(event)).resolves.toBe(true);
    await expect(bus.publish(event)).resolves.toBe(false);
    expect((await state(player)).wagered).toBe(STEP);
    expect(
      await ctx.db.select().from(promoRewards).where(eq(promoRewards.source, 'wheel')),
    ).toEqual([]);
  });
});
