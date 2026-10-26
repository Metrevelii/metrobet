import { cn } from '@metrobet/ui';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

type SectionProps = {
  title: ReactNode;
  action?: { href: string; label: string };
  className?: string;
  children: ReactNode;
};

export function Section({ title, action, className, children }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="flex items-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
