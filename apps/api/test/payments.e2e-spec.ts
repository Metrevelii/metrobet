import { createHmac } from 'node:crypto';

import { PAYMENT_SIGNATURE_HEADER, type PaymentCallback } from '@metrobet/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { MockBankCallbacks } from '../src/modules/payments/gateway/mock/mock-bank-callbacks.js';
import { players } from '../src/modules/players/players.schema.js';
import { createTestApp } from './create-app.js';
import { E2E_ENV } from './e2e-env.js';

type Player = { id: string; headers: Record<string, string> };

const sign = (body: string) =>
  createHmac('sha256', E2E_ENV.PAYMENT_GATEWAY_SECRET).update(body).digest('hex');

describe('payments (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (verified = true): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `pay-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    if (verified) {
      await ctx.db
        .update(players)
        .set({ verifiedAt: new Date(), kycStatus: 'verified' })
        .where(eq(players.id, body.player.id));
    }
    return { id: body.player.id, headers: { authorization: `Bearer ${body.session.token}` } };
  };
  const balance = async (player: Player) =>
    (await http().get('/api/wallet').set(player.headers).expect(200)).body.balance as number;
  const callback = (payload: PaymentCallback, signature?: string) => {
    const body = JSON.stringify(payload);
    return http()
      .post('/api/payments/callback')
      .set('content-type', 'application/json')
      .set(PAYMENT_SIGNATURE_HEADER, signature ?? sign(body))
      .send(body);
  };

  /** Starts a deposit and submits the mock bank's card page like a browser would. */
  const deposit = async (player: Player, amount: number, form: Record<string, string>) => {
    const { body } = await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'tbc', amount })
      .expect(201);
    const url = new URL(body.redirectUrl as string);
    expect(url.pathname).toBe('/api/payments/mock/checkout');
    const page = await http().get(`${url.pathname}${url.search}`).expect(200);
    expect(page.text).toContain('TBC Pay');
    const submitted = await http()
      .post(url.pathname)
      .type('form')
      .send({ t: url.searchParams.get('t')!, expiry: '12/39', cvc: '123', ...form });
    return { paymentId: body.payment.id as string, submitted };
  };
  const payment = async (player: Player, id: string) =>
    (await http().get(`/api/payments/${id}`).set(player.headers).expect(200)).body;

  beforeAll(async () => {
    ctx = await createTestApp();
    // The mock bank calls back over HTTP: route it into the test app instead.
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

  it('credits a deposit paid on the bank page and saves the card', async () => {
    const player = await signUp();
    const { paymentId, submitted } = await deposit(player, 50_00, {
      action: 'pay',
      number: '4111 1111 1111 1111',
    });
    expect(submitted.status).toBe(303);
    expect(submitted.headers.location).toMatch(new RegExp(`/wallet\\?payment=${paymentId}$`));
    expect(await payment(player, paymentId)).toMatchObject({
      status: 'succeeded',
      cardMask: '411111••••1111',
    });
    expect(await balance(player)).toBe(50_00);
    const cards = (await http().get('/api/payments/cards').set(player.headers).expect(200)).body;
    expect(cards).toEqual([expect.objectContaining({ brand: 'Visa', provider: 'tbc' })]);

    // The bank repeats its callback: nothing moves twice.
    await callback({
      paymentId,
      status: 'succeeded',
      amount: 50_00,
      providerReference: 'again',
    }).expect(200);
    expect(await balance(player)).toBe(50_00);
    // A contradicting callback for a final payment is refused.
    await callback({ paymentId, status: 'failed', amount: 50_00, providerReference: 'x' }).expect(
      409,
    );
  });

  it('records declined and cancelled deposits without moving money', async () => {
    const player = await signUp();
    const declined = await deposit(player, 20_00, {
      action: 'pay',
      number: '4000 0000 0000 0002',
    });
    expect(declined.submitted.status).toBe(303);
    expect(await payment(player, declined.paymentId)).toMatchObject({
      status: 'failed',
      reason: 'The card was declined',
    });
    const cancelled = await deposit(player, 20_00, { action: 'cancel' });
    expect(await payment(player, cancelled.paymentId)).toMatchObject({ status: 'cancelled' });
    const invalid = await deposit(player, 20_00, { action: 'pay', number: '1234' });
    expect(invalid.submitted.status).toBe(200);
    expect(invalid.submitted.text).toContain('Check the card number');
    expect(await balance(player)).toBe(0);
    expect((await http().get('/api/payments/cards').set(player.headers)).body).toEqual([]);
  });

  it('refuses unsigned callbacks, forged checkout links and deposits over the limit', async () => {
    const player = await signUp();
    const { body } = await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'bog', amount: 10_00 })
      .expect(201);
    await callback(
      { paymentId: body.payment.id, status: 'succeeded', amount: 10_00, providerReference: 'x' },
      '00'.repeat(32),
    ).expect(401);
    await callback({
      paymentId: body.payment.id,
      status: 'succeeded',
      amount: 99_00,
      providerReference: 'x',
    }).expect(400);
    await http().get('/api/payments/mock/checkout?t=forged.token').expect(400);
    expect(await balance(player)).toBe(0);

    await http()
      .put('/api/responsible-gaming/limits')
      .set(player.headers)
      .send({ kind: 'deposit', period: 'day', amount: 5_00 })
      .expect(200);
    const refused = await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'tbc', amount: 10_00 })
      .expect(403);
    expect(refused.body).toMatchObject({ code: 'LIMIT_EXCEEDED', limit: { remaining: 5_00 } });
  });

  it('reserves withdrawals, lets the player cancel, and finance approve or reject', async () => {
    const unverified = await signUp(false);
    expect(
      (
        await http()
          .post('/api/payments/withdrawals')
          .set(unverified.headers)
          .send({ cardId: crypto.randomUUID(), amount: 10_00 })
          .expect(403)
      ).body.code,
    ).toBe('UNVERIFIED');

    const player = await signUp();
    await deposit(player, 100_00, { action: 'pay', number: '5555 5555 5555 4444' });
    const [card] = (await http().get('/api/payments/cards').set(player.headers)).body;
    const withdraw = (amount: number) =>
      http()
        .post('/api/payments/withdrawals')
        .set(player.headers)
        .send({ cardId: card.id, amount });

    expect((await withdraw(200_00).expect(402)).body.code).toBe('INSUFFICIENT_FUNDS');
    const first = (await withdraw(30_00).expect(201)).body;
    expect(first).toMatchObject({ status: 'pending', cardMask: '555555••••4444' });
    expect(await balance(player)).toBe(70_00);
    await http()
      .post(`/api/payments/withdrawals/${first.id}/cancel`)
      .set(player.headers)
      .expect(200);
    expect(await balance(player)).toBe(100_00);
    await http()
      .post(`/api/payments/withdrawals/${first.id}/cancel`)
      .set(player.headers)
      .expect(409);

    const finance = await ctx.staffHeaders('finance');
    const support = await ctx.staffHeaders('support');
    const second = (await withdraw(40_00).expect(201)).body;
    const queue = await http()
      .get('/api/admin/payments')
      .query({ kind: 'withdrawal', status: 'pending', playerId: player.id })
      .set(support)
      .expect(200);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toEqual([second.id]);
    await http().post(`/api/admin/payments/${second.id}/approve`).set(support).expect(403);
    const approved = await http()
      .post(`/api/admin/payments/${second.id}/approve`)
      .set(finance)
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'succeeded', decidedBy: 'E2E finance' });
    expect(await balance(player)).toBe(60_00);
    await http().post(`/api/admin/payments/${second.id}/approve`).set(finance).expect(409);

    const third = (await withdraw(10_00).expect(201)).body;
    await http()
      .post(`/api/admin/payments/${third.id}/reject`)
      .set(finance)
      .send({ reason: 'Bonus wagering not complete' })
      .expect(200);
    expect(await payment(player, third.id)).toMatchObject({
      status: 'rejected',
      reason: 'Bonus wagering not complete',
    });
    expect(await balance(player)).toBe(60_00);

    const history = (await http().get('/api/wallet/transactions').set(player.headers)).body.items;
    expect(history.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining(['deposit', 'withdrawal', 'withdrawal_reversal']),
    );
    expect(history.some((item: { type: string }) => item.type === 'payout')).toBe(false);
  });

  it('needs a verified identity for withdrawals and for deposits past the threshold', async () => {
    const player = await signUp();
    await ctx.db.update(players).set({ kycStatus: 'unverified' }).where(eq(players.id, player.id));
    await deposit(player, 900_00, { action: 'pay', number: '4111 1111 1111 1111' });
    const [card] = (await http().get('/api/payments/cards').set(player.headers)).body;
    const refused = await http()
      .post('/api/payments/withdrawals')
      .set(player.headers)
      .send({ cardId: card.id, amount: 10_00 })
      .expect(403);
    expect(refused.body.code).toBe('KYC_REQUIRED');
    // 900 ₾ deposited: 100 ₾ more is fine, 100.01 ₾ crosses the 1 000 ₾ threshold.
    const over = await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'tbc', amount: 100_01 })
      .expect(403);
    expect(over.body.code).toBe('KYC_REQUIRED');
    await http()
      .post('/api/payments/deposits')
      .set(player.headers)
      .send({ provider: 'tbc', amount: 100_00 })
      .expect(201);
  });

  it('gives the money back when the bank refuses the payout', async () => {
    const player = await signUp();
    await deposit(player, 50_00, { action: 'pay', number: '4000 0000 0000 0119' });
    const [card] = (await http().get('/api/payments/cards').set(player.headers)).body;
    const { body } = await http()
      .post('/api/payments/withdrawals')
      .set(player.headers)
      .send({ cardId: card.id, amount: 20_00 })
      .expect(201);
    const finance = await ctx.staffHeaders('finance');
    const result = await http()
      .post(`/api/admin/payments/${body.id}/approve`)
      .set(finance)
      .expect(200);
    expect(result.body).toMatchObject({
      status: 'failed',
      reason: 'The card does not accept payouts',
    });
    expect(await balance(player)).toBe(50_00);
  });
});
