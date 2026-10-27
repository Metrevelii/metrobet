import { LOCALES } from '@metrobet/contracts';

const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`);

/**
 * Post-login destination. Only same-site relative paths are allowed (no open redirects), and a
 * leading locale is stripped because the locale-aware router adds the current one.
 */
export function safeNext(value: unknown, fallback = '/'): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return fallback;
  }
  return value.replace(LOCALE_PREFIX, '') || '/';
}
