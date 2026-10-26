import request from 'supertest';

import { createTestApp } from './create-app.js';

describe('GET /api/health (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx?.app.close());

  it('reports the database as up', () =>
    request(ctx.app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ status: 'up', services: { database: 'up' } }),
      ));
});
