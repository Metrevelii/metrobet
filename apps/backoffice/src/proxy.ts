import { type NextRequest, NextResponse } from 'next/server';

import { STAFF_COOKIE } from './lib/session';

/** Fast path: no session cookie → straight to /login. The API still validates every request. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(STAFF_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/((?!login|_next|.*\\..*).*)',
};
