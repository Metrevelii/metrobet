import type { Session } from '@metrobet/contracts';
import { cookies, headers } from 'next/headers';

/**
 * The player's session token lives in an httpOnly cookie on the web origin and is forwarded to
 * the API server-side, so browser JavaScript never sees it. Server-only module.
 */
export const SESSION_COOKIE = 'mb_session';

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(session: Session) {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Forwards the player's IP and browser so the API's rate limits and session records see the real client. */
export async function clientHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const ip = incoming.get('x-forwarded-for')?.split(',')[0]?.trim() ?? incoming.get('x-real-ip');
  const userAgent = incoming.get('user-agent');
  return { ...(ip && { 'x-forwarded-for': ip }), ...(userAgent && { 'user-agent': userAgent }) };
}
