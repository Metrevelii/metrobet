import type { Session } from '@metrobet/contracts';
import { cookies, headers } from 'next/headers';

/** Staff session token: httpOnly cookie on the backoffice origin, forwarded to the API server-side. */
export const STAFF_COOKIE = 'mb_staff';

export async function getStaffToken(): Promise<string | null> {
  return (await cookies()).get(STAFF_COOKIE)?.value ?? null;
}

export async function setStaffCookie(session: Session) {
  (await cookies()).set(STAFF_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(session.expiresAt),
  });
}

export async function clearStaffCookie() {
  (await cookies()).delete(STAFF_COOKIE);
}

export async function clientHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const ip = incoming.get('x-forwarded-for')?.split(',')[0]?.trim() ?? incoming.get('x-real-ip');
  const userAgent = incoming.get('user-agent');
  return { ...(ip && { 'x-forwarded-for': ip }), ...(userAgent && { 'user-agent': userAgent }) };
}
