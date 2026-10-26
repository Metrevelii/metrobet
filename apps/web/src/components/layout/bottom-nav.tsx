'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV, type NavItem } from '@/config/navigation';
import { Link } from '@/i18n/navigation';

import { NavItems } from './nav-items';

const BOTTOM_NAV = MAIN_NAV.filter((item) => item.bottomNav);

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations('Nav');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
        active && 'text-primary',
      )}
    >
      <Icon className="size-5" />
      {t(item.labelKey)}
    </Link>
  );
}

export function BottomNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-card pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <NavItems
        items={BOTTOM_NAV}
        renderItem={(item, active) => <BottomNavLink key={item.href} item={item} active={active} />}
      />
    </nav>
  );
}
