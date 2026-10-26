'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV, type NavItem } from '@/config/navigation';
import { Link } from '@/i18n/navigation';

import { NavItems } from './nav-items';

function SideNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations('Nav');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      <Icon className={cn('size-4', active && 'text-primary')} />
      {t(item.labelKey)}
    </Link>
  );
}

export function SideNav({ className }: { className?: string }) {
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      <NavItems
        items={MAIN_NAV}
        renderItem={(item, active) => <SideNavLink key={item.href} item={item} active={active} />}
      />
    </nav>
  );
}
