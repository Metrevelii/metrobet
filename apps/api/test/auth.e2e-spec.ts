import type { PlayerAuthResponse } from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';

import { DevNotifier } from '../src/modules/notifications/dev-notifier.js';
import { Notifier } from '../src/modules/notifications/notifier.js';
import { createTestApp } from './create-app.js';

const ADULT_DOB = '1990-05-17';
const PASSWORD = 'secret123';
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('auth (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());
  /** Latest code sent to `to` (dev outbox). */
  const lastCode = (to: string) => {
    const outbox = (ctx.app.get(Notifier) as DevNotifier).outbox;
    return outbox.find((message) => message.to === to)!.params.code;
  };
  const register = (identifier: string, overrides: object = {}) =>
    http()
      .post('/api/auth/register')
      .send({
        identifier,
        password: PASSWORD,
        dateOfBirth: ADULT_DOB,
        acceptTerms: true,
        locale: 'en',
        ...overrides,
      });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => ctx.db.execute(sql`TRUNCATE players, sessions, verification_codes CASCADE`));
  afterAll(() => ctx?.app.close());

  it('registers with email, signs in, verifies the contact and signs out', async () => {
    const { body } = await register('Player@Example.com').expect(201);
    const { session, player } = body as PlayerAuthResponse;
    expect(player).toMatchObject({
      email: 'player@example.com',
      phone: null,
      verified: false,
      kycStatus: 'unverified',
    });

    await http().get('/api/auth/me').set(bearer(session.token)).expect(200);

    await http()
      .post('/api/auth/verification/confirm')
      .set(bearer(session.token))
      .send({ code: '000000' })
      .expect(400);
    const { body: verified } = await http()
      .post('/api/auth/verification/confirm')
      .set(bearer(session.token))
      .send({ code: lastCode('player@example.com') })
      .expect(200);
    expect(verified.verified).toBe(true);

    await http().post('/api/auth/logout').set(bearer(session.token)).expect(204);
    await http().get('/api/auth/me').set(bearer(session.token)).expect(401);

    await http()
      .post('/api/auth/login')
      .send({ identifier: 'player@example.com', password: 'wrong-pass1' })
      .expect(401);
    await http()
      .post('/api/auth/login')
      .send({ identifier: 'PLAYER@example.com', password: PASSWORD })
      .expect(200);
  });

  it('registers with a Georgian mobile number in any common format', async () => {
    const { body } = await register('555 12 34 56').expect(201);
    expect(body.player.phone).toBe('+995555123456');
    await http()
      .post('/api/auth/login')
      .send({ identifier: '+995 555 123 456', password: PASSWORD })
      .expect(200);
    await register('+995555123456').expect(409);
  });

  it('enforces the minimum age, terms and password policy', async () => {
    await register('young@example.com', { dateOfBirth: '2010-01-01' }).expect(400);
    await register('noterms@example.com', { acceptTerms: false }).expect(400);
    await register('weak@example.com', { password: 'password' }).expect(400);
  });

  it('resets a password with a code, signing out every session', async () => {
    const { body } = await register('reset@example.com').expect(201);
    const oldToken = (body as PlayerAuthResponse).session.token;

    await http()
      .post('/api/auth/password/forgot')
      .send({ identifier: 'nobody@example.com', locale: 'en' })
      .expect(204);
    // The verification code from registration is still in its resend cooldown; wait it out via DB.
    await ctx.db.execute(
      sql`UPDATE verification_codes SET created_at = now() - interval '2 minutes'`,
    );
    await http()
      .post('/api/auth/password/forgot')
      .send({ identifier: 'reset@example.com', locale: 'en' })
      .expect(204);

    await http()
      .post('/api/auth/password/reset')
      .send({ identifier: 'reset@example.com', code: '123456', password: 'newpass123' })
      .expect(400);
    await http()
      .post('/api/auth/password/reset')
      .send({
        identifier: 'reset@example.com',
        code: lastCode('reset@example.com'),
        password: 'newpass123',
      })
      .expect(204);

    await http().get('/api/auth/me').set(bearer(oldToken)).expect(401);
    await http()
      .post('/api/auth/login')
      .send({ identifier: 'reset@example.com', password: 'newpass123' })
      .expect(200);
  });

  it('burns a code after 5 wrong guesses', async () => {
    const { body } = await register('guess@example.com').expect(201);
    const token = (body as PlayerAuthResponse).session.token;
    for (let i = 0; i < 5; i += 1) {
      await http()
        .post('/api/auth/verification/confirm')
        .set(bearer(token))
        .send({ code: '999999' })
        .expect(400);
    }
    await http()
      .post('/api/auth/verification/confirm')
      .set(bearer(token))
      .send({ code: lastCode('guess@example.com') })
      .expect(400);
  });

  it('staff can sign in and read their profile; player tokens are not staff tokens', async () => {
    const headers = await ctx.staffHeaders('support');
    const { body } = await http().get('/api/admin/auth/me').set(headers).expect(200);
    expect(body.role).toBe('support');

    const { body: player } = await register('notstaff@example.com').expect(201);
    await http().get('/api/admin/auth/me').set(bearer(player.session.token)).expect(401);
  });
});
