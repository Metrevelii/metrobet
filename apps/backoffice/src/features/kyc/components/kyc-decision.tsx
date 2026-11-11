'use client';

import { type AdminKycCheck, KYC_REJECTIONS, type KycRejection } from '@metrobet/contracts';
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
  NativeSelect,
  Textarea,
  toast,
} from '@metrobet/ui';
import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';

import { decideKyc } from '../actions';
import { KYC_REJECTION_LABELS } from '../labels';

/** Approve (our own checks still run) or reject with a reason the player sees. */
export function KycDecision({ check }: { check: AdminKycCheck }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejection, setRejection] = useState<KycRejection>('document');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      const result = await decideKyc(check.id, { decision: 'approve' });
      if (!result.ok) toast.error(result.error);
      else if (result.data.status === 'approved') toast.success('Identity verified.');
      else {
        toast.warning(
          `Not approved: ${KYC_REJECTION_LABELS[result.data.rejection ?? 'other'].toLowerCase()}.`,
        );
      }
    });

  const reject = () =>
    startTransition(async () => {
      const result = await decideKyc(check.id, { decision: 'reject', rejection, note });
      if (result.ok) {
        toast.success('Check rejected. The player can try again.');
        setRejecting(false);
      } else {
        setNoteError(result.fieldErrors?.note);
        if (!result.fieldErrors?.note) toast.error(result.error);
      }
    });

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" disabled={pending} onClick={approve}>
        <Check />
        Approve
      </Button>
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
            <AlertDialogTitle>Reject identity check</AlertDialogTitle>
            <AlertDialogDescription>
              The player sees the reason and can start a new check.
            </AlertDialogDescription>
            <Field label="Reason">
              <NativeSelect
                value={rejection}
                onChange={(event) => setRejection(event.target.value as KycRejection)}
              >
                {KYC_REJECTIONS.map((value) => (
                  <option key={value} value={value}>
                    {KYC_REJECTION_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Note" hint="Stored in the audit log." error={noteError}>
              <Textarea
                value={note}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Photo of the document is cut off"
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
