import type { Promotion, PromotionInput } from '@metrobet/contracts';
import request from 'supertest';

import { auditLog } from '../src/modules/audit/audit.schema.js';
import { ADMIN_HEADERS, createTestApp } from './create-app.js';

const text = (value: string) => ({ ka: `${value} ka`, en: `${value} en`, ru: `${value} ru` });

const input = (slug: string, overrides: Partial<PromotionInput> = {}): PromotionInput => ({
  slug,
  category: 'casino',
  title: text(`${slug} title`),
  subtitle: text('subtitle'),
  ctaLabel: text('cta'),
  ctaHref: null,
  content: text('content'),
  terms: text('terms'),
  image: { desktop: '/promotions/a-desktop.svg', mobile: '/promotions/a-mobile.svg' },
  placements: ['home', 'casino'],
  isActive: true,
  startsAt: null,
  endsAt: null,
  ...overrides,
});

describe('promotions (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());
  const create = (body: PromotionInput) =>
    http().post('/api/admin/promotions').set(ADMIN_HEADERS).send(body).expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => ctx.reset());
  afterAll(() => ctx?.app.close());

  describe('admin auth', () => {
    it('rejects requests without the admin key', () =>
      http().get('/api/admin/promotions').expect(401));

    it('rejects a wrong admin key', () =>
      http().get('/api/admin/promotions').set('x-admin-key', 'nope').expect(401));
  });

  it('creates promotions in display order, audits and revalidates', async () => {
    const first = (await create(input('first'))).body as Promotion;
    const second = (await create(input('second'))).body as Promotion;
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);

    const { body: list } = await http().get('/api/admin/promotions').set(ADMIN_HEADERS).expect(200);
    expect(list.map((p: Promotion) => p.slug)).toEqual(['first', 'second']);

    const audit = await ctx.db.select().from(auditLog);
    expect(audit.map((entry) => entry.action)).toEqual(['promotion.create', 'promotion.create']);
    expect(ctx.revalidate).toHaveBeenCalledWith('promotions');
  });

  it('rejects invalid input and duplicate slugs', async () => {
    await http()
      .post('/api/admin/promotions')
      .set(ADMIN_HEADERS)
      .send({ ...input('bad'), placements: [] })
      .expect(400);
    await create(input('taken'));
    await http().post('/api/admin/promotions').set(ADMIN_HEADERS).send(input('taken')).expect(409);
  });

  it('updates, toggles, reorders and deletes', async () => {
    const a = (await create(input('a'))).body as Promotion;
    const b = (await create(input('b'))).body as Promotion;

    const { body: updated } = await http()
      .put(`/api/admin/promotions/${a.id}`)
      .set(ADMIN_HEADERS)
      .send(input('a-renamed'))
      .expect(200);
    expect(updated.slug).toBe('a-renamed');

    const { body: toggled } = await http()
      .patch(`/api/admin/promotions/${a.id}/active`)
      .set(ADMIN_HEADERS)
      .send({ isActive: false })
      .expect(200);
    expect(toggled.isActive).toBe(false);

    const { body: reordered } = await http()
      .put('/api/admin/promotions/order')
      .set(ADMIN_HEADERS)
      .send({ ids: [b.id, a.id] })
      .expect(200);
    expect(reordered.map((p: Promotion) => p.id)).toEqual([b.id, a.id]);

    await http()
      .put('/api/admin/promotions/order')
      .set(ADMIN_HEADERS)
      .send({ ids: [b.id] })
      .expect(400);

    await http().delete(`/api/admin/promotions/${b.id}`).set(ADMIN_HEADERS).expect(204);
    await http().get(`/api/admin/promotions/${b.id}`).set(ADMIN_HEADERS).expect(404);
  });

  it('exposes only live promotions publicly, localized and filtered by placement', async () => {
    await create(input('live'));
    await create(input('off', { isActive: false }));
    await create(input('expired', { endsAt: '2020-01-01T00:00:00.000Z' }));
    await create(input('sports-only', { placements: ['sports'] }));

    const { body } = await http().get('/api/promotions?locale=ka&placement=home').expect(200);
    expect(body.map((p: { slug: string }) => p.slug)).toEqual(['live']);
    expect(body[0].title).toBe('live title ka');

    await http().get('/api/promotions/off?locale=en').expect(404);
    await http().get('/api/promotions?locale=de').expect(400);
  });

  describe('media upload', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );

    it('stores a real image and serves it', async () => {
      const { body } = await http()
        .post('/api/admin/media/promotions')
        .set(ADMIN_HEADERS)
        .attach('file', png, { filename: 'banner.png', contentType: 'image/png' })
        .expect(201);
      expect(body.url).toMatch(/\/media\/promotions\/[\w-]+\.png$/);
      await http().get(new URL(body.url).pathname).expect(200).expect('content-type', 'image/png');
    });

    it('rejects files that are not raster images, whatever their MIME type says', () =>
      http()
        .post('/api/admin/media/promotions')
        .set(ADMIN_HEADERS)
        .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400));
  });
});
