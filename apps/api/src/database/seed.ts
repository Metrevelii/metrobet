/**
 * Inserts the demo catalogue. Idempotent: existing slugs are left untouched.
 * Run with `pnpm --filter @metrobet/api db:seed` (after db:migrate).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { PROMOTIONS_SEED } from '../modules/promotions/promotions.seed.js';
import * as schema from './schema/index.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema, casing: 'snake_case' });

const rows = PROMOTIONS_SEED.map(({ id: _id, image, startsAt, endsAt, ...promotion }) => ({
  ...promotion,
  imageDesktop: image.desktop,
  imageMobile: image.mobile,
  startsAt: startsAt ? new Date(startsAt) : null,
  endsAt: endsAt ? new Date(endsAt) : null,
}));

const inserted = await db
  .insert(schema.promotions)
  .values(rows)
  .onConflictDoNothing({ target: schema.promotions.slug })
  .returning({ slug: schema.promotions.slug });

console.warn(
  `Seeded ${inserted.length} promotion(s): ${inserted.map((row) => row.slug).join(', ') || 'none (already present)'}`,
);
await pool.end();
