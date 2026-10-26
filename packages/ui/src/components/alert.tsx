import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

const alertVariants = cva('rounded-md border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-muted text-foreground',
      destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
      success: 'border-success/40 bg-success/10 text-success',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type AlertProps = ComponentProps<'div'> & VariantProps<typeof alertVariants>;

/** Inline status message. Destructive alerts are announced to screen readers immediately. */
export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
