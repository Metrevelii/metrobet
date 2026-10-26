/** Applies pending SQL migrations from ./drizzle. Run with `pnpm --filter @metrobet/api db:migrate`. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
console.warn('Migrations applied');
await pool.end();
