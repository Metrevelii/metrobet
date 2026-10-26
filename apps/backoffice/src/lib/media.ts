const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Artwork may be absolute (uploaded media) or site-relative (served by the player site). */
export function resolveMediaUrl(src: string): string {
  return src.startsWith('/') ? `${WEB_URL}${src}` : src;
}
