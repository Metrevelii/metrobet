/**
 * Seeds demo data: promotions (idempotent by slug), the casino catalogue (synced from the bound
 * aggregator) and, outside production, a dev admin (admin@metrobet.local / SEED_ADMIN_PASSWORD).
 * Run with `pnpm --filter @metrobet/api db:seed` after db:migrate.
 * Boots the Nest context so seeding reuses the real services.
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { CasinoSyncService } from '../modules/casino/casino-sync.service.js';
import { StaffService } from '../modules/staff/staff.service.js';
import { staff } from '../modules/staff/staff.schema.js';
import { promotions } from '../modules/promotions/promotions.schema.js';
import { PROMOTIONS_SEED } from '../modules/promotions/promotions.seed.js';
import { eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from './database.tokens.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });

try {
  const db = app.get<Database>(DRIZZLE);
  const inserted = await db
    .insert(promotions)
    .values(
      PROMOTIONS_SEED.map(({ id: _id, image, startsAt, endsAt, ...promotion }) => ({
        ...promotion,
        imageDesktop: image.desktop,
        imageMobile: image.mobile,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      })),
    )
    .onConflictDoNothing({ target: promotions.slug })
    .returning({ slug: promotions.slug });
  console.warn(`Promotions: ${inserted.length} inserted (existing slugs kept)`);

  const casino = await app.get(CasinoSyncService).sync();
  console.warn(`Casino: ${casino.providers} providers, ${casino.games} games synced`);

  const adminEmail = 'admin@metrobet.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    console.warn('Staff: skipped (production)');
  } else if (!adminPassword) {
    console.warn('Staff: skipped (set SEED_ADMIN_PASSWORD to create the dev admin)');
  } else if (
    (await db.select({ id: staff.id }).from(staff).where(eq(staff.email, adminEmail))).length > 0
  ) {
    console.warn(`Staff: ${adminEmail} already exists`);
  } else {
    await app
      .get(StaffService)
      .create({ email: adminEmail, name: 'Dev Admin', role: 'admin', password: adminPassword });
    console.warn(`Staff: created ${adminEmail} (password = SEED_ADMIN_PASSWORD)`);
  }
} finally {
  await app.close();
}
