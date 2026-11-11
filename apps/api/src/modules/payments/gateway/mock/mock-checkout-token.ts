import { createHmac, timingSafeEqual } from 'node:crypto';

import { paymentProviderSchema } from '@metrobet/contracts';
import { z } from 'zod';

/** What the mock bank needs to show its card page, carried in the redirect URL (stateless). */
const checkoutSchema = z.object({
  paymentId: z.uuid(),
  provider: paymentProviderSchema,
  amount: z.number().int().positive(),
  returnUrl: z.url(),
  /** Expiry, epoch ms. */
  exp: z.number().int(),
});
export type Checkout = z.infer<typeof checkoutSchema>;

const mac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(`checkout:${payload}`).digest('base64url');

export function signCheckout(secret: string, checkout: Checkout): string {
  const payload = Buffer.from(JSON.stringify(checkout)).toString('base64url');
  return `${payload}.${mac(secret, payload)}`;
}

/** The checkout, or null when the token is forged, malformed or expired. */
export function verifyCheckout(secret: string, token: string, now = Date.now()): Checkout | null {
  const [payload = '', signature = ''] = token.split('.');
  const given = Buffer.from(signature);
  const expected = Buffer.from(mac(secret, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const checkout = checkoutSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    return checkout.exp > now ? checkout : null;
  } catch {
    return null;
  }
}
