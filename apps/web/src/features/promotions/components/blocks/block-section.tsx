import { cn } from '@metrobet/ui';
import type { ReactNode } from 'react';

/** Heading + content wrapper shared by blocks that have a title. */
export function BlockSection({
  title,
  className,
  children,
}: {
  title?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {title && <h2 className="text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}
