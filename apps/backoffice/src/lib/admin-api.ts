import { apiErrorSchema } from '@metrobet/contracts';
import type { z } from 'zod';

import { getStaffToken } from './session';

export const API_URL = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

/**
 * Server-only call to /api/admin/* as the signed-in staff member (session cookie → bearer). Parses success bodies with
 * `schema` (or returns undefined for 204) and throws AdminApiError with the API's message.
 */
export async function adminFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const isJson = init.body !== undefined && !(init.body instanceof FormData);
  const token = await getStaffToken();
  const response = await fetch(`${API_URL}/admin/${path.replace(/^\//, '')}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(isJson && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
    const message = body.success
      ? [body.data.message].flat().join(', ')
      : `API responded ${response.status}`;
    throw new AdminApiError(response.status, message, body.success ? body.data.issues : []);
  }
  return schema.parse(response.status === 204 ? undefined : await response.json());
}
