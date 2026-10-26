'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV, type NavItem } from '@/config/navigation';
import { Link } from '@/i18n/navigation';

import { NavItems } from './nav-items';

const HEADER_TABS = MAIN_NAV.filter((item) => item.href !== '/');

function HeaderTab({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations('Nav');
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-16 items-center px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
        active &&
          'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
      )}
    >
      {t(item.labelKey)}
    </Link>
  );
}

export function HeaderTabs() {
  return (
    <nav className="hidden items-center md:flex">
      <NavItems
        items={HEADER_TABS}
        renderItem={(item, active) => <HeaderTab key={item.href} item={item} active={active} />}
      />
    </nav>
  );
}
