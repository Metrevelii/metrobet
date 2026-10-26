'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV } from '@/config/navigation';
import { useIsActive } from '@/hooks/use-is-active';
import { Link } from '@/i18n/navigation';

function SideNavLink({ item }: { item: (typeof MAIN_NAV)[number] }) {
  const t = useTranslations('Nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
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
      {MAIN_NAV.map((item) => (
        <SideNavLink key={item.href} item={item} />
      ))}
    </nav>
  );
}
