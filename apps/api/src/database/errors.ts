import { DrizzleQueryError } from 'drizzle-orm';

const PG_UNIQUE_VIOLATION = '23505';

/** True when a query failed on a unique constraint (optionally a specific one). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (!cause || typeof cause !== 'object') return false;
  const { code, constraint: name } = cause as { code?: string; constraint?: string };
  return code === PG_UNIQUE_VIOLATION && (!constraint || name === constraint);
}
