'use client';

import type { AdminBonus } from '@metrobet/contracts';
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
import { useState, useTransition } from 'react';

import { money } from '@/lib/format';

import { cancelBonus } from '../actions';

export function CancelBonusButton({ bonus }: { bonus: AdminBonus }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await cancelBonus(bonus.id, { reason });
      if (result.ok) {
        toast.success(`Bonus cancelled. ${money(bonus.balance)} bonus money taken back.`);
        setOpen(false);
      } else {
        setReasonError(result.fieldErrors?.reason);
        if (!result.fieldErrors?.reason) toast.error(result.error);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Cancel bonus
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
          <AlertDialogTitle>Cancel this bonus?</AlertDialogTitle>
          <AlertDialogDescription>
            The remaining {money(bonus.balance)} bonus money is taken back at once. The player sees
            the bonus as cancelled.
          </AlertDialogDescription>
          <Field label="Reason" hint="Stored in the audit log." error={reasonError}>
            <Textarea
              value={reason}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Several accounts on the same card"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep it</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              Cancel bonus
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
