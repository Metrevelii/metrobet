'use client';

import { type ReactNode, Suspense } from 'react';

import type { NavItem } from '@/config/navigation';
import { usePathname } from '@/i18n/navigation';

/** True when `href` is the current route or one of its parents (home matches only itself). */
export function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavItemsProps<T extends NavItem> = {
  items: readonly T[];
  renderItem: (item: T, active: boolean) => ReactNode;
};

function ActiveNavItems<T extends NavItem>({ items, renderItem }: NavItemsProps<T>) {
  const pathname = usePathname();
  return items.map((item) => renderItem(item, isActivePath(pathname, item.href)));
}

/**
 * Renders nav links with active state. The pathname is request data, so links render
 * inactive in the prerendered shell and highlight once it streams in (Cache Components).
 */
export function NavItems<T extends NavItem>(props: NavItemsProps<T>) {
  return (
    <Suspense fallback={props.items.map((item) => props.renderItem(item, false))}>
      <ActiveNavItems {...props} />
    </Suspense>
  );
}
