import { paymentProviderSchema } from '@metrobet/contracts';
import { z } from 'zod';

import { signToken, verifyToken } from '../../../../common/signed-token/signed-token.js';

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

export const signCheckout = (secret: string, checkout: Checkout) =>
  signToken(secret, 'checkout', checkout);

/** The checkout, or null when the token is forged, malformed or expired. */
export const verifyCheckout = (secret: string, token: string, now = Date.now()) =>
  verifyToken(secret, 'checkout', token, checkoutSchema, now);
