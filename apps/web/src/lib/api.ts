import { type ApiErrorBody, apiErrorSchema } from '@metrobet/contracts';
import type { z } from 'zod';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** Parsed error body (message + validation issues) when the API sent one. */
    readonly body: ApiErrorBody | null = null,
  ) {
    super(`API responded ${status} for ${path}`);
  }
}

type QueryParams = Record<string, string | number | undefined>;

export type ApiOptions = {
  /** Player session token, sent as `Authorization: Bearer`. */
  token?: string | null;
  /** Extra headers, e.g. the player's forwarded IP (see clientHeaders in lib/session). */
  headers?: Record<string, string>;
};

async function request<T extends z.ZodType>(
  method: 'GET' | 'POST',
  path: string,
  schema: T,
  { params = {}, body, token, headers }: ApiOptions & { params?: QueryParams; body?: unknown },
): Promise<z.infer<T>> {
  const url = new URL(`${API_URL}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Mutations and authenticated reads are never cached.
    ...((method === 'POST' || token) && { cache: 'no-store' as const }),
  });

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiError(response.status, path, error.success ? error.data : null);
  }
  return schema.parse(response.status === 204 ? undefined : await response.json());
}

/**
 * Server-side GET against @metrobet/api, validated with a contracts schema.
 * Public content: wrap callers in `'use cache'` (with cacheTag/cacheLife) to control freshness.
 */
export function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  params: QueryParams = {},
  options: ApiOptions = {},
) {
  return request('GET', path, schema, { ...options, params });
}

/** Server-side POST with a JSON body. Never cached. */
export function apiPost<T extends z.ZodType>(
  path: string,
  schema: T,
  body: unknown = {},
  options: ApiOptions = {},
) {
  return request('POST', path, schema, { ...options, body });
}
