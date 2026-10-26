'use client';

import { cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { MAIN_NAV } from '@/config/navigation';
import { useIsActive } from '@/hooks/use-is-active';
import { Link } from '@/i18n/navigation';

function BottomNavLink({ item }: { item: (typeof MAIN_NAV)[number] }) {
  const t = useTranslations('Nav');
  const active = useIsActive(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
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
      {MAIN_NAV.map((item) => (
        <BottomNavLink key={item.href} item={item} />
      ))}
    </nav>
  );
}
