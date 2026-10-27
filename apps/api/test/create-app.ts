import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import type { Mock } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { StaffRole } from '@metrobet/contracts';

import { type Database, DRIZZLE } from '../src/database/database.tokens.js';
import { StaffService } from '../src/modules/staff/staff.service.js';
import { WebRevalidationService } from '../src/modules/web/web-revalidation.service.js';

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

  /** Creates a staff member with `role` and returns Authorization headers for their session. */
  let staffCount = 0;
  const staffHeaders = async (role: StaffRole) => {
    const service = app.get(StaffService);
    const email = `${role}-${Date.now()}-${(staffCount += 1)}@e2e.test`;
    await service.create({ email, name: `E2E ${role}`, role, password: 'Passw0rd!' });
    const { session } = await service.login(email, 'Passw0rd!', {});
    return { authorization: `Bearer ${session.token}` };
  };
  return { app, db, revalidate, reset, staffHeaders };
}
