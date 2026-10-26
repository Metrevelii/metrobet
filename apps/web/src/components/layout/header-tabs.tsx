'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV } from '@/config/navigation';
import { useIsActive } from '@/hooks/use-is-active';
import { Link } from '@/i18n/navigation';

function HeaderTab({ item }: { item: (typeof MAIN_NAV)[number] }) {
  const t = useTranslations('Nav');
  const active = useIsActive(item.href);
  return (
    <Link
      href={item.href}
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
      {MAIN_NAV.slice(1).map((item) => (
        <HeaderTab key={item.href} item={item} />
      ))}
    </nav>
  );
}
