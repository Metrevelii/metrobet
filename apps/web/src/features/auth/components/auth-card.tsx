import { Card } from '@metrobet/ui';
import type { ReactNode } from 'react';

type AuthCardProps = { title: string; subtitle?: string; footer?: ReactNode; children: ReactNode };

/** Centered card used by every auth page. */
export function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4 md:py-10">
      <Card className="flex flex-col gap-6 bg-glow p-6 md:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </header>
        {children}
      </Card>
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
