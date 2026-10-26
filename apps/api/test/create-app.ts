import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import type { Mock } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { type Database, DRIZZLE } from '../src/database/database.tokens.js';
import { WebRevalidationService } from '../src/modules/web/web-revalidation.service.js';

export const ADMIN_HEADERS = { 'x-admin-key': process.env.ADMIN_API_KEY! };

/** Boots the real app against the e2e database; outbound web revalidation is stubbed. */
export async function createTestApp() {
  const revalidate: Mock<WebRevalidationService['revalidate']> = vi
    .fn()
    .mockResolvedValue(undefined);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WebRevalidationService)
    .useValue({ revalidate })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const db = app.get<Database>(DRIZZLE);
  const reset = () => db.execute(sql`TRUNCATE promotions, audit_log`);
  return { app, db, revalidate, reset };
}
