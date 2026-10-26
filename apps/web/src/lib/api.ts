import type { z } from 'zod';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API responded ${status} for ${path}`);
  }
}

type QueryParams = Record<string, string | undefined>;

/**
 * Server-side GET against @metrobet/api, validated with a contracts schema.
 * Wrap callers in `'use cache'` (with cacheTag/cacheLife) to control freshness.
 */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  params: QueryParams = {},
): Promise<z.infer<T>> {
  const url = new URL(`${API_URL}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status, path);
  return schema.parse(await response.json());
}
