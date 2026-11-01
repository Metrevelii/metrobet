'use client';

import type { SuspensionScope } from '@metrobet/contracts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Field,
  Textarea,
  toast,
} from '@metrobet/ui';
import { Lock, LockOpen } from 'lucide-react';
import { useState, useTransition } from 'react';

import { resume, suspend } from '../actions';

type SuspendButtonProps = {
  scope: SuspensionScope;
  targetId: string;
  /** What is being suspended, e.g. "Arsenal – Chelsea" or "Total 2.5". */
  name: string;
  suspended: boolean;
  size?: 'sm' | 'md';
};

/** Suspend / resume an event or market; asks for a reason (stored in the audit log). */
export function SuspendButton({
  scope,
  targetId,
  name,
  suspended,
  size = 'sm',
}: SuspendButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const verb = suspended ? 'Resume' : 'Suspend';

  const submit = () =>
    startTransition(async () => {
      const input = { scope, targetId, reason };
      const result = suspended ? await resume(input) : await suspend(input);
      if (result.ok) {
        toast.success(suspended ? `${name} reopened.` : `${name} suspended.`);
        setOpen(false);
        setReason('');
        setReasonError(undefined);
      } else {
        setReasonError(result.fieldErrors?.reason);
        if (!result.fieldErrors?.reason) toast.error(result.error);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={suspended ? 'secondary' : 'outline'} size={size}>
          {suspended ? <LockOpen /> : <Lock />}
          {verb}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <AlertDialogTitle>
            {verb} {scope === 'event' ? 'event' : 'market'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {suspended
              ? `Players can bet on ${name} again as soon as you confirm.`
              : `${name} is locked for players at once (betslips, new bets and cash-out).`}
          </AlertDialogDescription>
          <Field label="Reason" hint="Stored in the audit log." error={reasonError}>
            <Textarea
              value={reason}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              placeholder={suspended ? 'e.g. Line-ups confirmed' : 'e.g. Feed delay, checking'}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button
              type="submit"
              variant={suspended ? 'primary' : 'destructive'}
              disabled={pending}
            >
              {pending ? `${verb.slice(0, -1)}ing…` : verb}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
