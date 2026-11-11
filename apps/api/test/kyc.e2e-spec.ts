import { createHmac } from 'node:crypto';

import { KYC_SIGNATURE_HEADER } from '@metrobet/contracts';
import request from 'supertest';

import { MockKycCallbacks } from '../src/modules/kyc/provider/mock/mock-kyc-callbacks.js';
import { createTestApp } from './create-app.js';
import { E2E_ENV } from './e2e-env.js';

type Player = { id: string; headers: Record<string, string> };

const DOB = '1990-01-01';
/** A fresh 11-digit personal number; the ending picks the mock provider's outcome. */
const personalNumber = (ending = '1234') =>
  `${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}${ending}`;

describe('KYC (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());

  const signUp = async (): Promise<Player> => {
    const { body } = await http()
      .post('/api/auth/register')
      .send({
        identifier: `kyc-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        dateOfBirth: DOB,
        acceptTerms: true,
        locale: 'en',
      })
      .expect(201);
    return { id: body.player.id, headers: { authorization: `Bearer ${body.session.token}` } };
  };
  const overview = async (player: Player) =>
    (await http().get('/api/kyc').set(player.headers).expect(200)).body;

  /** Starts a check and fills the mock provider's page like a browser would. */
  const verify = async (player: Player, fields: Record<string, string>) => {
    const { body } = await http().post('/api/kyc/checks').set(player.headers).expect(201);
    const url = new URL(body.redirectUrl as string);
    expect(url.pathname).toBe('/api/kyc/mock/verify');
    expect((await http().get(`${url.pathname}${url.search}`).expect(200)).text).toContain(
      'VerifyID',
    );
    const submitted = await http()
      .post(url.pathname)
      .type('form')
      .send({
        t: url.searchParams.get('t')!,
        action: 'submit',
        documentType: 'id_card',
        documentNumber: '12AB34567',
        firstName: 'Nino',
        lastName: 'Beridze',
        dateOfBirth: DOB,
        ...fields,
      });
    return { checkId: body.checkId as string, submitted };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    vi.spyOn(
      ctx.app.get(MockKycCallbacks) as unknown as {
        send: (body: string, headers: Record<string, string>) => Promise<number>;
      },
      'send',
    ).mockImplementation(
      async (body, headers) =>
        (await http().post('/api/kyc/callback').set(headers).send(body)).status,
    );
  });
  afterAll(() => ctx?.app.close());

  it('verifies a player whose document matches the account', async () => {
    const player = await signUp();
    expect(await overview(player)).toMatchObject({ status: 'unverified', latest: null });
    const { checkId, submitted } = await verify(player, { personalNumber: personalNumber() });
    expect(submitted.status).toBe(303);
    expect(submitted.headers.location).toMatch(new RegExp(`/account/identity\\?check=${checkId}$`));
    expect(await overview(player)).toMatchObject({
      status: 'verified',
      firstName: 'Nino',
      lastName: 'Beridze',
      latest: { id: checkId, status: 'approved', rejection: null },
    });
    expect((await http().get('/api/auth/me').set(player.headers).expect(200)).body.kycStatus).toBe(
      'verified',
    );
    await http().post('/api/kyc/checks').set(player.headers).expect(409);
  });

  it('rejects a wrong date of birth, a used personal number and unreadable documents', async () => {
    const first = await signUp();
    const number = personalNumber();
    const mismatch = await verify(first, { personalNumber: number, dateOfBirth: '1991-02-02' });
    expect((await overview(first)).latest).toMatchObject({
      id: mismatch.checkId,
      status: 'rejected',
      rejection: 'dob_mismatch',
    });
    expect((await overview(first)).status).toBe('rejected');
    await verify(first, { personalNumber: number });
    expect((await overview(first)).status).toBe('verified');

    const second = await signUp();
    await verify(second, { personalNumber: number });
    expect(await overview(second)).toMatchObject({
      status: 'rejected',
      latest: { rejection: 'duplicate' },
    });
    await verify(second, { personalNumber: personalNumber('0000') });
    expect((await overview(second)).latest.rejection).toBe('document');

    const invalid = await verify(second, { personalNumber: '123' });
    expect(invalid.submitted.status).toBe(200);
    expect(invalid.submitted.text).toContain('11 digits');
  });

  it('sends unclear checks to staff review', async () => {
    const player = await signUp();
    const { checkId } = await verify(player, { personalNumber: personalNumber('9999') });
    expect(await overview(player)).toMatchObject({
      status: 'pending',
      latest: { status: 'review' },
    });
    await http().post('/api/kyc/checks').set(player.headers).expect(409);

    const support = await ctx.staffHeaders('support');
    const finance = await ctx.staffHeaders('finance');
    const queue = await http()
      .get('/api/admin/kyc')
      .query({ status: 'review', playerId: player.id })
      .set(finance)
      .expect(200);
    expect(queue.body.items[0]).toMatchObject({
      id: checkId,
      registeredDateOfBirth: DOB,
      person: { firstName: 'Nino', dateOfBirth: DOB },
    });
    await http()
      .post(`/api/admin/kyc/${checkId}/decision`)
      .set(finance)
      .send({ decision: 'approve' })
      .expect(403);
    await http()
      .post(`/api/admin/kyc/${checkId}/decision`)
      .set(support)
      .send({ decision: 'reject', rejection: 'other', note: '' })
      .expect(400);
    const decided = await http()
      .post(`/api/admin/kyc/${checkId}/decision`)
      .set(support)
      .send({ decision: 'approve' })
      .expect(200);
    expect(decided.body).toMatchObject({ status: 'approved', reviewedBy: 'E2E support' });
    expect((await overview(player)).status).toBe('verified');
    await http()
      .post(`/api/admin/kyc/${checkId}/decision`)
      .set(support)
      .send({ decision: 'approve' })
      .expect(409);
  });

  it('accepts only signed callbacks and is idempotent', async () => {
    const player = await signUp();
    const { checkId } = await verify(player, { personalNumber: personalNumber() });
    const send = (payload: object, signature?: string) => {
      const body = JSON.stringify(payload);
      return http()
        .post('/api/kyc/callback')
        .set('content-type', 'application/json')
        .set(
          KYC_SIGNATURE_HEADER,
          signature ?? createHmac('sha256', E2E_ENV.KYC_PROVIDER_SECRET).update(body).digest('hex'),
        )
        .send(body);
    };
    await send({ checkId, outcome: 'approved', providerReference: 'x' }, '00'.repeat(32)).expect(
      401,
    );
    await send({ checkId, outcome: 'approved', providerReference: 'again' }).expect(200);
    await send({ checkId, outcome: 'rejected', providerReference: 'late' }).expect(409);
    expect((await overview(player)).status).toBe('verified');
    await http().get('/api/kyc/mock/verify?t=forged.token').expect(400);
  });
});
