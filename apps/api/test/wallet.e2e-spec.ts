import type { Wallet, WalletTransactionsPage } from '@metrobet/contracts';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';

import { InsufficientFundsError } from '../src/modules/wallet/ledger-math.js';
import { Ledger } from '../src/modules/wallet/ledger.js';
import { walletAccounts, walletEntries } from '../src/modules/wallet/wallet.schema.js';
import { createTestApp } from './create-app.js';

describe('wallet (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async () => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `wallet-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: '1990-01-01',
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    return {
      id: body.player.id as string,
      headers: { authorization: `Bearer ${body.session.token}` },
    };
  };
  const deposit = (headers: Record<string, string>, amount: number, key?: string) =>
    http()
      .post('/api/dev/wallet/deposit')
      .set({ ...headers, ...(key && { 'idempotency-key': key }) })
      .send({ amount });
  const balance = async (headers: Record<string, string>) =>
    ((await http().get('/api/wallet').set(headers).expect(200)).body as Wallet).balance;
  /** A bet straight through the ledger (the game wallet API that will call it comes next). */
  const bet = (playerId: string, amount: number, key = crypto.randomUUID()) =>
    ctx.app.get(Ledger).post({
      idempotencyKey: `test:${key}`,
      type: 'bet',
      playerId,
      gameSlug: 'some-slot',
      legs: [
        { account: { kind: 'player', playerId }, amount: -amount },
        { account: { kind: 'house' }, amount },
      ],
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx?.app.close());

  it('needs a player session', async () => {
    await http().get('/api/wallet').expect(401);
    await http().post('/api/dev/wallet/deposit').send({ amount: 100 }).expect(401);
  });

  it('starts at zero, takes deposits and lists them newest first', async () => {
    const { headers } = await signUp();
    expect(await balance(headers)).toBe(0);

    expect((await deposit(headers, 100_00).expect(200)).body).toEqual({
      currency: 'GEL',
      balance: 100_00,
    });
    await deposit(headers, 25_50).expect(200);
    await deposit(headers, 1000_01).expect(400); // over the dev limit

    const { body } = await http().get('/api/wallet/transactions').set(headers).expect(200);
    expect(body as WalletTransactionsPage).toMatchObject({
      total: 2,
      items: [
        { type: 'deposit', amount: 25_50, balanceAfter: 125_50, gameSlug: null },
        { type: 'deposit', amount: 100_00, balanceAfter: 100_00 },
      ],
    });
  });

  it('applies an idempotency key once and refuses it for a different amount', async () => {
    const { headers } = await signUp();
    const key = crypto.randomUUID();
    await deposit(headers, 50_00, key).expect(200);
    expect((await deposit(headers, 50_00, key).expect(200)).body.balance).toBe(50_00);
    await deposit(headers, 60_00, key).expect(409);
    expect(await balance(headers)).toBe(50_00);
  });

  it('never overspends when bets race', async () => {
    const { id, headers } = await signUp();
    await deposit(headers, 100_00).expect(200);

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => bet(id, 30_00)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    for (const result of results.filter((item) => item.status === 'rejected')) {
      expect(result.reason).toBeInstanceOf(InsufficientFundsError);
    }
    expect(await balance(headers)).toBe(10_00);
  });

  it('counts concurrent deposits exactly', async () => {
    const { headers } = await signUp();
    await Promise.all(Array.from({ length: 10 }, () => deposit(headers, 1_00).expect(200)));
    expect(await balance(headers)).toBe(10_00);
  });

  it('keeps the books balanced and the balance cache equal to the entries', async () => {
    const { id, headers } = await signUp();
    await deposit(headers, 20_00).expect(200);
    await bet(id, 5_00);

    const [books] = await ctx.db
      .select({ total: sql<string>`sum(${walletAccounts.balance})` })
      .from(walletAccounts);
    expect(Number(books!.total)).toBe(0);

    const drift = await ctx.db.execute(sql`
      select a.id from wallet_accounts a
      left join wallet_entries e on e.account_id = a.id
      group by a.id having a.balance <> coalesce(sum(e.amount), 0)`);
    expect(drift.rows).toEqual([]);
  });

  it('rejects unbalanced or edited ledger rows in the database itself', async () => {
    const { id, headers } = await signUp();
    await deposit(headers, 10_00).expect(200);
    const [account] = await ctx.db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.playerId, id));

    const unbalanced = ctx.db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into wallet_transactions (id, idempotency_key, type, player_id)
        values ('00000000-0000-4000-8000-0000000000aa', ${`raw:${id}`}, 'adjustment', ${id})`);
      await tx.insert(walletEntries).values({
        transactionId: '00000000-0000-4000-8000-0000000000aa',
        accountId: account!.id,
        amount: 1_000_00,
        balanceAfter: 1_010_00,
      });
    });
    await expect(unbalanced).rejects.toThrow();

    await expect(
      ctx.db
        .update(walletEntries)
        .set({ amount: 1 })
        .where(eq(walletEntries.accountId, account!.id)),
    ).rejects.toThrow();
    expect(await balance(headers)).toBe(10_00);
  });
});
