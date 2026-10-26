import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DRIZZLE } from '../src/database/database.tokens.js';

describe('/api/promotions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DRIZZLE)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists localized promotions for a placement', () =>
    request(app.getHttpServer())
      .get('/api/promotions?locale=en&placement=home')
      .expect(200)
      .expect(({ body }) => {
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toHaveProperty('title');
        expect(body.map((p: { slug: string }) => p.slug)).not.toContain('summer-drop');
      }));

  it('rejects an unsupported locale', () =>
    request(app.getHttpServer()).get('/api/promotions?locale=de').expect(400));

  it('returns 404 for an unknown slug', () =>
    request(app.getHttpServer()).get('/api/promotions/nope?locale=en').expect(404));
});
