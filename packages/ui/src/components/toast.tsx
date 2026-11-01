'use client';

import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { type ReactNode, useSyncExternalStore } from 'react';

import { cn } from '../lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
  /** A toast with the same id replaces the previous one (e.g. repeated "odds changed"). */
  id?: string;
  description?: ReactNode;
  /** One button, e.g. "View my bets" or "Top up". The toast closes when it is used. */
  action?: { label: string; onClick: () => void };
  /** ms before it closes by itself; defaults per variant (errors stay longer). */
  duration?: number;
};

type ToastItem = Required<Pick<ToastOptions, 'id' | 'duration'>> &
  Omit<ToastOptions, 'id' | 'duration'> & {
    variant: ToastVariant;
    title: ReactNode;
    open: boolean;
    /** Bumped when an id is reused, so the toast restarts (animation + timer). */
    version: number;
  };

const DURATION: Record<ToastVariant, number> = {
  success: 4_000,
  info: 5_000,
  warning: 6_000,
  error: 8_000,
};
const MAX_VISIBLE = 3;
/** Closed toasts stay mounted this long so their exit animation can play. */
const EXIT_MS = 300;

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function publish(next: ToastItem[]) {
  items = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function close(id: string) {
  if (!items.some((item) => item.id === id && item.open)) return;
  publish(items.map((item) => (item.id === id ? { ...item, open: false } : item)));
  setTimeout(() => publish(items.filter((item) => item.id !== id || item.open)), EXIT_MS);
}

function show(variant: ToastVariant, title: ReactNode, options: ToastOptions = {}): string {
  const id = options.id ?? `toast-${(counter += 1)}`;
  const previous = items.find((item) => item.id === id);
  const item: ToastItem = {
    ...options,
    id,
    variant,
    title,
    duration: options.duration ?? DURATION[variant],
    open: true,
    version: (previous?.version ?? 0) + 1,
  };
  const others = items.filter((entry) => entry.id !== id);
  // Only the newest few stay open; older ones close (and animate out).
  const open = others.filter((entry) => entry.open);
  const overflow = new Set(
    open.slice(0, Math.max(0, open.length - (MAX_VISIBLE - 1))).map((entry) => entry.id),
  );
  publish([...others, item]);
  for (const entryId of overflow) close(entryId);
  return id;
}

/**
 * Show a toast from anywhere in client code: `toast.success('Saved')`,
 * `toast.error('Not enough balance', { action: { label: 'Top up', onClick } })`. Needs one
 * `<Toaster />` in the app. Results of actions only: field errors stay next to their field.
 */
export const toast = {
  success: (title: ReactNode, options?: ToastOptions) => show('success', title, options),
  error: (title: ReactNode, options?: ToastOptions) => show('error', title, options),
  warning: (title: ReactNode, options?: ToastOptions) => show('warning', title, options),
  info: (title: ReactNode, options?: ToastOptions) => show('info', title, options),
  dismiss: (id: string) => close(id),
};

const ICONS = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info };
const ACCENT: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};
const BAR: Record<ToastVariant, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

type ToasterProps = {
  /** Accessible name of the close buttons (translate it). */
  closeLabel?: string;
  /** Accessible name of the notifications region (screen readers, F8 to focus). */
  label?: string;
  className?: string;
};

/**
 * Renders the toasts (Radix Toast: announced to screen readers, swipe or Esc to dismiss, timer
 * paused on hover and focus). Top centre on phones, top right from `md`, below a 4rem header.
 */
export function Toaster({
  closeLabel = 'Close',
  label = 'Notifications',
  className,
}: ToasterProps) {
  const toasts = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );

  return (
    <ToastPrimitive.Provider swipeDirection="right" label={label}>
      {toasts.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <ToastPrimitive.Root
            key={`${item.id}:${item.version}`}
            open={item.open}
            duration={item.duration}
            type={item.variant === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => {
              if (!open) close(item.id);
            }}
            className={cn(
              'group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border bg-popover p-4 pr-10 text-popover-foreground shadow-lg',
              'data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in',
              'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-toast-swipe-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
              'motion-reduce:animate-none',
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', ACCENT[item.variant])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {item.description}
                </ToastPrimitive.Description>
              )}
              {item.action && (
                <ToastPrimitive.Action
                  altText={item.action.label}
                  onClick={item.action.onClick}
                  className="mt-1 self-start rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  {item.action.label}
                </ToastPrimitive.Action>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label={closeLabel}
              className="absolute top-3 right-3 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </ToastPrimitive.Close>
            {/* Time left; pauses while hovered like the Radix timer. */}
            <span
              aria-hidden
              style={{ ['--progress-duration' as string]: `${item.duration}ms` }}
              className={cn(
                'absolute inset-x-0 bottom-0 h-0.5 origin-left animate-progress opacity-60 [animation-direction:reverse] group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-reduce:hidden',
                BAR[item.variant],
              )}
            />
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        className={cn(
          'fixed top-[4.5rem] left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none',
          'md:right-4 md:left-auto md:translate-x-0',
          className,
        )}
      />
    </ToastPrimitive.Provider>
  );
}
