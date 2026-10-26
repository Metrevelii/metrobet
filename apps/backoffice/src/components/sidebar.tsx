'use client';

import { cn } from '@metrobet/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { BACKOFFICE_NAV, type NavItem } from '@/config/navigation';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

function SidebarLink({
  item: { href, label, icon: Icon },
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      <Icon className={cn('size-4', active && 'text-primary')} />
      {label}
    </Link>
  );
}

function ActiveLinks() {
  const pathname = usePathname();
  return BACKOFFICE_NAV.map((item) => (
    <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
  ));
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-card p-4 md:flex">
      <div className="px-2 text-lg font-black tracking-tight">
        metro<span className="text-primary">bet</span>
        <span className="ml-2 text-xs font-semibold text-muted-foreground">admin</span>
      </div>
      <nav className="flex flex-col gap-1">
        {/* The pathname is request data: render inactive links in the static shell. */}
        <Suspense
          fallback={BACKOFFICE_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={false} />
          ))}
        >
          <ActiveLinks />
        </Suspense>
      </nav>
    </aside>
  );
}
