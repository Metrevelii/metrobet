import { rm } from 'node:fs/promises';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';

import { E2E_ENV } from './e2e-env.js';

/** Creates the e2e database if needed, then rebuilds its schema from the migrations. */
export default async function setup() {
  const url = new URL(E2E_ENV.DATABASE_URL);
  const database = url.pathname.slice(1);

  const admin = new Client({
    connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString(),
  });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    database,
  ]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${database}"`);
  await admin.end();

  const pool = new Pool({ connectionString: url.toString() });
  await pool.query(
    'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
  );
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  await pool.end();

  return () => rm(E2E_ENV.MEDIA_DIR, { recursive: true, force: true });
}
