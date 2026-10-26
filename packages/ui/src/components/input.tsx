import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-input bg-muted px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
