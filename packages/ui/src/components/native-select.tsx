import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

/** Styled native <select>: accessible and mobile-friendly by default. */
export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        className="h-10 w-full cursor-pointer appearance-none rounded-md border border-input bg-muted pr-9 pl-3 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:border-destructive"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
