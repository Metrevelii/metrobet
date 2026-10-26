import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export const chipVariants = cva(
  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-primary-foreground',
        false: 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      },
    },
    defaultVariants: { selected: false },
  },
);

export type ChipProps = ComponentProps<'button'> &
  VariantProps<typeof chipVariants> & {
    /** Render a link (or other element) with chip styles. */
    asChild?: boolean;
  };

/** Pill-shaped filter/toggle. As a button it reports `aria-pressed`; links should set aria-current. */
export function Chip({ className, selected, asChild, ...props }: ChipProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      {...(!asChild && { type: 'button', 'aria-pressed': Boolean(selected) })}
      className={cn(chipVariants({ selected }), className)}
      {...props}
    />
  );
}
