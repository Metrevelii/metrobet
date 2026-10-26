/**
 * Seeds demo data: promotions (idempotent by slug) and the casino catalogue (synced from the
 * bound aggregator). Run with `pnpm --filter @metrobet/api db:seed` after db:migrate.
 * Boots the Nest context so seeding reuses the real services.
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { CasinoSyncService } from '../modules/casino/casino-sync.service.js';
import { promotions } from '../modules/promotions/promotions.schema.js';
import { PROMOTIONS_SEED } from '../modules/promotions/promotions.seed.js';
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
} finally {
  await app.close();
}
