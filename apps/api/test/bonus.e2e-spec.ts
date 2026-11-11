import { createHmac } from 'node:crypto';

import {
  GAME_WALLET_SIGNATURE_HEADER,
  type GameWalletOperation,
  type Selection,
} from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { bonuses } from '../src/modules/bonus/bonus.schema.js';
import { BonusService } from '../src/modules/bonus/bonus.service.js';
import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { CasinoService } from '../src/modules/casino/casino.service.js';
import { MockBankCallbacks } from '../src/modules/payments/gateway/mock/mock-bank-callbacks.js';
import { players } from '../src/modules/players/players.schema.js';
import { promotions } from '../src/modules/promotions/promotions.schema.js';
import { promotionsSeed } from '../src/modules/promotions/promotions.seed.js';
import { SportsbookStore } from '../src/modules/sportsbook/sportsbook.store.js';
import { createTestApp } from './create-app.js';
import { E2E_ENV } from './e2e-env.js';

type Player = { id: string; headers: Record<string, string> };
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

describe('bonus money (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let bonus: BonusService;
  let slot: string;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (deposit = 0): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `bonus-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    const player = {
      id: body.player.id,
      headers: { authorization: `Bearer ${body.session.token}` },
    };
    if (deposit) {
      await http().post('/api/dev/wallet/deposit').set(player.headers).send({ amount: deposit });
    }
    return player;
  };
  const wallet = async (player: Player) =>
    (await http().get('/api/wallet').set(player.headers).expect(200)).body as {
      balance: number;
      bonusBalance: number;
    };
  const overview = async (player: Player) =>
    (await http().get('/api/bonuses?locale=en').set(player.headers).expect(200)).body;
  const grant = (player: Player, amount: number, wageringMultiplier = 10) =>
    bonus.grant({
      playerId: player.id,
      amount,
      wageringMultiplier,
      validDays: 7,
      grantKey: id('test'),
    });

  /** A real-money game session and signed provider calls on it. */
  const game = async (player: Player) => {
    const { body } = await http()
      .post(`/api/casino/games/${slot}/sessions`)
      .set(player.headers)
      .send({ locale: 'en' })
      .expect(200);
    const sessionToken = new URL(body.url as string).searchParams.get('session')!;
    const call = (operation: GameWalletOperation, payload: object) => {
      const raw = JSON.stringify({ sessionToken, currency: 'GEL', ...payload });
      return http()
        .post(`/api/game-wallet/${operation}`)
        .set('content-type', 'application/json')
        .set(
          GAME_WALLET_SIGNATURE_HEADER,
          createHmac('sha256', E2E_ENV.GAME_WALLET_SECRET).update(raw).digest('hex'),
        )
        .send(raw);
    };
    return {
      bet: (roundId: string, amount: number, transactionId = id('bet')) =>
        call('bet', { transactionId, roundId, amount }),
      win: (roundId: string, amount: number) =>
        call('win', { transactionId: id('win'), roundId, amount }),
      rollback: (roundId: string, rollbackOf: string) =>
        call('rollback', { transactionId: id('rb'), roundId, rollbackOf }),
    };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    bonus = ctx.app.get(BonusService);
    await ctx.app.get(CasinoSyncService).sync();
    slot = (
      await ctx.app.get(CasinoService).listGames({
        type: 'slot',
        provider: 'golden-fleece-studios',
        page: 1,
        pageSize: 1,
      })
    ).items[0]!.slug;
    vi.spyOn(
      ctx.app.get(MockBankCallbacks) as unknown as {
        send: (body: string, headers: Record<string, string>) => Promise<number>;
      },
      'send',
    ).mockImplementation(
      async (body, headers) =>
        (await http().post('/api/payments/callback').set(headers).send(body)).status,
    );
  });
  afterAll(() => ctx?.app.close());

  it('grants the welcome bonus on the first qualifying deposit, once', async () => {
    await ctx.reset();
    const welcome = promotionsSeed(slot).find((item) => item.slug === 'welcome-bonus')!;
    const { id: _id, image, startsAt: _s, endsAt: _e, ...rest } = welcome;
    await ctx.db.insert(promotions).values({
      ...rest,
      imageDesktop: image.desktop,
      imageMobile: image.mobile,
    });
    const player = await signUp();
    const depositAtBank = async (amount: number) => {
      const { body } = await http()
        .post('/api/payments/deposits')
        .set(player.headers)
        .send({ provider: 'tbc', amount })
        .expect(201);
      const url = new URL(body.redirectUrl as string);
      await http()
        .post(url.pathname)
        .type('form')
        .send({
          t: url.searchParams.get('t')!,
          action: 'pay',
          number: '4111 1111 1111 1111',
          expiry: '12/39',
          cvc: '123',
        })
        .expect(303);
    };
    await depositAtBank(80_00);
    expect(await wallet(player)).toEqual({ currency: 'GEL', balance: 80_00, bonusBalance: 80_00 });
    const { active } = await overview(player);
    expect(active).toMatchObject({
      amount: 80_00,
      wageringRequired: 800_00,
      wagered: 0,
      title: '100% welcome bonus up to 500 ₾',
    });
    // Second deposit: no second bonus.
    await depositAtBank(50_00);
    expect(await wallet(player)).toMatchObject({ balance: 130_00, bonusBalance: 80_00 });
    await ctx.reset();
  });

  it('spends cash first, pays wins and refunds back in the stake’s proportions', async () => {
    const player = await signUp(50_00);
    await grant(player, 100_00);
    const play = await game(player);

    const round = id('round');
    const bet = await play.bet(round, 80_00).expect(200);
    expect(bet.body.balance).toBe(70_00); // what the game shows: cash + bonus
    expect(await wallet(player)).toMatchObject({ balance: 0, bonusBalance: 70_00 });
    // 30 of the 80 staked were bonus money: 15 of a 40 win goes back as bonus money.
    await play.win(round, 40_00).expect(200);
    expect(await wallet(player)).toMatchObject({ balance: 25_00, bonusBalance: 85_00 });

    const second = id('round');
    const betId = id('bet');
    await play.bet(second, 30_00, betId).expect(200);
    expect(await wallet(player)).toMatchObject({ balance: 0, bonusBalance: 80_00 });
    await play.rollback(second, betId).expect(200);
    expect(await wallet(player)).toMatchObject({ balance: 25_00, bonusBalance: 85_00 });

    // 110 more than both balances together: refused, nothing moves.
    expect((await play.bet(id('round'), 110_01).expect(402)).body.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('refunds a voided sports ticket to cash and bonus as staked', async () => {
    const player = await signUp(10_00);
    await grant(player, 20_00);
    const store = ctx.app.get(SportsbookStore);
    for (let i = 0; i < 50 && store.sports().every((s) => s.upcomingCount === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const pick = store
      .overview('football')
      .upcoming.flatMap((group) => group.events)
      .map((summary) =>
        store.event(summary.id)?.markets.find((m) => m.type === '1x2' && m.status === 'open'),
      )
      .flatMap(
        (market) => market?.selections.filter((s) => s.active).slice(0, 1) ?? [],
      )[0] as Selection;
    const placed = await http()
      .post('/api/sportsbook/bets')
      .set(player.headers)
      .send({
        idempotencyKey: crypto.randomUUID(),
        mode: 'single',
        selections: [{ selectionId: pick.id, odds: pick.odds }],
        stakes: [25_00],
      })
      .expect(200);
    expect(placed.body.balance).toBe(5_00);
    expect(await wallet(player)).toMatchObject({ balance: 0, bonusBalance: 5_00 });
    const risk = await ctx.staffHeaders('risk');
    await http()
      .post(`/api/admin/bets/${placed.body.tickets[0].id}/void`)
      .set(risk)
      .send({ reason: 'Test void' })
      .expect(200);
    expect(await wallet(player)).toMatchObject({ balance: 10_00, bonusBalance: 20_00 });
  });

  it('converts the bonus to cash once the wagering is done', async () => {
    const player = await signUp(10_00);
    await grant(player, 20_00, 2); // wager 40
    const play = await game(player);
    for (const amount of [15_00, 15_00]) {
      const round = id('round');
      await play.bet(round, amount).expect(200);
      await play.win(round, amount).expect(200);
    }
    expect((await overview(player)).active).toMatchObject({
      wagered: 30_00,
      wageringRequired: 40_00,
    });
    const round = id('round');
    await play.bet(round, 10_00).expect(200);
    const { active, history } = await overview(player);
    expect(active).toBeNull();
    expect(history[0]).toMatchObject({ status: 'completed', wagered: 40_00 });
    const after = await wallet(player);
    expect(after.bonusBalance).toBe(0);
    expect(after.balance).toBe(history[0].converted);
    expect(after.balance).toBe(20_00);
  });

  it('asks before a withdrawal forfeits the bonus', async () => {
    const player = await signUp(100_00);
    await ctx.db
      .update(players)
      .set({ verifiedAt: new Date(), kycStatus: 'verified' })
      .where(eq(players.id, player.id));
    await grant(player, 50_00);
    // A card from a real (mock bank) deposit.
    const { body } = await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'tbc', amount: 10_00 })
      .expect(201);
    const url = new URL(body.redirectUrl as string);
    await http()
      .post(url.pathname)
      .type('form')
      .send({
        t: url.searchParams.get('t')!,
        action: 'pay',
        number: '4111 1111 1111 1111',
        expiry: '12/39',
        cvc: '123',
      })
      .expect(303);
    const [card] = (await http().get('/api/payments/cards').set(player.headers)).body;
    const withdraw = (forfeitBonus?: boolean) =>
      http()
        .post('/api/payments/withdrawals')
        .set(player.headers)
        .send({
          cardId: card.id,
          amount: 20_00,
          ...(forfeitBonus !== undefined && { forfeitBonus }),
        });
    expect((await withdraw().expect(409)).body.code).toBe('BONUS_ACTIVE');
    await withdraw(true).expect(201);
    expect(await wallet(player)).toMatchObject({ balance: 90_00, bonusBalance: 0 });
    expect((await overview(player)).history[0]).toMatchObject({
      status: 'forfeited',
      reason: 'Withdrawal requested',
    });
  });

  it('expires on time, and late bonus wins follow the bonus’s fate', async () => {
    const player = await signUp(0);
    const granted = (await grant(player, 30_00))!;
    const play = await game(player);
    const round = id('round');
    await play.bet(round, 10_00).expect(200); // all bonus money

    await ctx.db
      .update(bonuses)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(bonuses.id, granted.id));
    await bonus.sweep();
    expect(await wallet(player)).toMatchObject({ balance: 0, bonusBalance: 0 });
    expect((await overview(player)).history[0]).toMatchObject({ status: 'expired' });

    // The round pays out after the bonus expired: the bonus share is forfeited too.
    await play.win(round, 25_00).expect(200);
    await bonus.sweep();
    expect(await wallet(player)).toMatchObject({ balance: 0, bonusBalance: 0 });

    const support = await ctx.staffHeaders('support');
    const listed = await http()
      .get(`/api/admin/players/${player.id}/bonuses`)
      .set(support)
      .expect(200);
    expect(listed.body[0]).toMatchObject({ status: 'expired', amount: 30_00 });
  });

  it('lets support cancel an active bonus with a reason', async () => {
    const player = await signUp(0);
    const granted = (await grant(player, 15_00))!;
    const support = await ctx.staffHeaders('support');
    const finance = await ctx.staffHeaders('finance');
    await http()
      .post(`/api/admin/bonuses/${granted.id}/cancel`)
      .set(finance)
      .send({ reason: 'Abuse' })
      .expect(403);
    await http()
      .post(`/api/admin/bonuses/${granted.id}/cancel`)
      .set(support)
      .send({ reason: 'Multiple accounts' })
      .expect(200);
    expect(await wallet(player)).toMatchObject({ bonusBalance: 0 });
    await http()
      .post(`/api/admin/bonuses/${granted.id}/cancel`)
      .set(support)
      .send({ reason: 'Again' })
      .expect(409);
  });
});
