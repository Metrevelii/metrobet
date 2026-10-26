'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** Accessible title (visually hidden when `hideTitle`). */
  title: string;
  hideTitle?: boolean;
  closeLabel?: string;
};

/** Bottom sheet for mobile (betslip, filters). Focus-trapped, closes on Esc / overlay tap. */
export function SheetContent({
  className,
  children,
  title,
  hideTitle,
  closeLabel = 'Close',
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-xl border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-lg',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <DialogPrimitive.Title className={cn('text-base font-bold', hideTitle && 'sr-only')}>
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
