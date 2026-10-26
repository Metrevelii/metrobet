'use client';

import { usePathname } from '@/i18n/navigation';

/** True when `href` is the current route or one of its parents (home matches only itself). */
export function useIsActive(href: string) {
  const pathname = usePathname();
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
