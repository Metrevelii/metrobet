'use client';

import { cn } from '../lib/cn';
import { Label } from './label';
import { cloneElement, type ReactElement, type ReactNode, useId } from 'react';

type FieldProps = {
  label: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  /** A single form control; receives id, aria-invalid and aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
};

/** Label + control + hint/error, wired for accessibility. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {message}
        </p>
      )}
    </div>
  );
}
