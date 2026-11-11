'use client';

import type { AdminPayment } from '@metrobet/contracts';
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
import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';

import { money } from '@/lib/format';

import { approveWithdrawal, rejectWithdrawal } from '../actions';

/** Approve (pay out to the card) or reject (money back, with a reason the player sees). */
export function WithdrawalActions({ payment }: { payment: AdminPayment }) {
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const amount = money(payment.amount);

  const approve = () =>
    startTransition(async () => {
      const result = await approveWithdrawal(payment.id);
      setApproving(false);
      if (!result.ok) toast.error(result.error);
      else if (result.data.status === 'succeeded') toast.success(`${amount} paid out.`);
      else toast.warning(`The bank refused the payout: ${result.data.reason}. Money returned.`);
    });

  const reject = () =>
    startTransition(async () => {
      const result = await rejectWithdrawal(payment.id, { reason });
      if (result.ok) {
        toast.success(`Withdrawal rejected. ${amount} returned to the player.`);
        setRejecting(false);
        setReason('');
        setReasonError(undefined);
      } else {
        setReasonError(result.fieldErrors?.reason);
        if (!result.fieldErrors?.reason) toast.error(result.error);
      }
    });

  return (
    <div className="flex justify-end gap-2">
      <AlertDialog open={approving} onOpenChange={setApproving}>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={pending}>
            <Check />
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Pay out {amount}?</AlertDialogTitle>
          <AlertDialogDescription>
            The bank sends {amount} to {payment.cardMask} ({payment.playerContact}). This can&apos;t
            be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={approve} disabled={pending}>
              Pay out
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejecting} onOpenChange={setRejecting}>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            <X />
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              reject();
            }}
          >
            <AlertDialogTitle>Reject withdrawal of {amount}</AlertDialogTitle>
            <AlertDialogDescription>
              The money goes back to the player&apos;s balance at once.
            </AlertDialogDescription>
            <Field
              label="Reason"
              hint="The player sees this. Stored in the audit log."
              error={reasonError}
            >
              <Textarea
                value={reason}
                rows={2}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Please complete identity verification first"
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={pending}>
                Reject
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
