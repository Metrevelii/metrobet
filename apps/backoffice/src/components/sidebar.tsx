'use client';

import { cn } from '@metrobet/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BACKOFFICE_NAV } from '@/config/navigation';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-card p-4 md:flex">
      <div className="px-2 text-lg font-black tracking-tight">
        metro<span className="text-primary">bet</span>
        <span className="ml-2 text-xs font-semibold text-muted-foreground">admin</span>
      </div>
      <nav className="flex flex-col gap-1">
        {BACKOFFICE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                active && 'bg-accent text-foreground',
              )}
            >
              <Icon className={cn('size-4', active && 'text-primary')} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
