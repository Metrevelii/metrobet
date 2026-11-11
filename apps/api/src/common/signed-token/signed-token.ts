import { createHmac, timingSafeEqual } from 'node:crypto';

import type { z } from 'zod';

const mac = (secret: string, purpose: string, payload: string) =>
  createHmac('sha256', secret).update(`${purpose}:${payload}`).digest('base64url');

/**
 * A tamper-proof, expiring value carried in a URL (`<base64url json>.<hmac>`). Used by our mock
 * providers' hosted pages so they need no server-side state. `purpose` keeps tokens of one kind
 * from being accepted as another.
 */
export function signToken(secret: string, purpose: string, data: { exp: number }): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${mac(secret, purpose, payload)}`;
}

/** The data, or null when the token is forged, malformed, of another purpose or expired. */
export function verifyToken<T extends { exp: number }>(
  secret: string,
  purpose: string,
  token: string,
  schema: z.ZodType<T>,
  now = Date.now(),
): T | null {
  const [payload = '', signature = ''] = token.split('.');
  const given = Buffer.from(signature);
  const expected = Buffer.from(mac(secret, purpose, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = schema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}
