import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { z } from 'zod';

/** Phone numbers without a country code are read as Georgian. */
export const DEFAULT_PHONE_COUNTRY = 'GE';

export type Identifier = { type: 'email'; value: string } | { type: 'phone'; value: string };

const emailSchema = z.email();

/**
 * Login identifier: an email (lower-cased) or a mobile number (normalized to E.164, e.g.
 * "+995555123456"). Returns null when it's neither.
 */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return emailSchema.safeParse(email).success ? { type: 'email', value: email } : null;
  }
  const phone = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
  return phone?.isValid() ? { type: 'phone', value: phone.number } : null;
}

export const identifierSchema = z
  .string()
  .trim()
  .min(3, 'identifierRequired')
  .max(254)
  .transform((value, ctx) => {
    const identifier = parseIdentifier(value);
    if (!identifier) {
      ctx.addIssue({ code: 'custom', message: 'identifierInvalid' });
      return z.NEVER;
    }
    return identifier;
  });
