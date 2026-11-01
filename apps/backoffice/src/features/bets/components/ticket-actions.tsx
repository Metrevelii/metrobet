'use client';

import { type AdminTicket, SELECTION_RESULTS } from '@metrobet/contracts';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  NativeSelect,
  Textarea,
  toast,
} from '@metrobet/ui';
import { useState, useTransition } from 'react';

import { money } from '@/lib/format';
import { selectionText } from '@/lib/sportsbook-labels';

import { settleSelection, voidTicket } from '../actions';

/** Runs a risk action: success and API errors as toasts, the reason's error next to the field. */
function useMutation() {
  const [pending, startTransition] = useTransition();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const run = (action: () => ReturnType<typeof voidTicket>, done: string, reset: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        reset();
        setReasonError(undefined);
        toast.success(done);
      } else {
        setReasonError(result.fieldErrors?.reason);
        if (!result.fieldErrors?.reason) toast.error(result.error);
      }
    });
  return { pending, reasonError, run };
}

/** Settle one unresolved selection by hand (wrong or missing feed result). */
function SettleSelectionForm({ ticket }: { ticket: AdminTicket }) {
  const unresolved = ticket.selections.filter((selection) => selection.result === null);
  const [selectionId, setSelectionId] = useState(unresolved[0]?.selectionId ?? '');
  const [result, setResult] = useState<(typeof SELECTION_RESULTS)[number]>('won');
  const [reason, setReason] = useState('');
  const { pending, reasonError, run } = useMutation();
  if (unresolved.length === 0) return null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => settleSelection(ticket.id, selectionId, { result, reason }),
          'Selection settled.',
          () => setReason(''),
        );
      }}
    >
      <Field label="Selection">
        <NativeSelect value={selectionId} onChange={(event) => setSelectionId(event.target.value)}>
          {unresolved.map((selection) => (
            <option key={selection.selectionId} value={selection.selectionId}>
              {selection.home} – {selection.away}:{' '}
              {selectionText(selection.marketType, selection.line, selection.selectionKey)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Result">
        <NativeSelect
          value={result}
          onChange={(event) => setResult(event.target.value as typeof result)}
        >
          {SELECTION_RESULTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Reason" hint="Stored in the audit log." error={reasonError}>
        <Textarea value={reason} rows={2} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Settling…' : 'Settle selection'}
      </Button>
    </form>
  );
}

/** Void the whole ticket: the stake goes back to the player. */
function VoidTicketForm({ ticket }: { ticket: AdminTicket }) {
  const [reason, setReason] = useState('');
  const { pending, reasonError, run } = useMutation();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => voidTicket(ticket.id, { reason }),
          'Ticket voided, stake refunded.',
          () => setReason(''),
        );
      }}
    >
      <Field label="Reason" hint="Stored in the audit log." error={reasonError}>
        <Textarea
          value={reason}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Palpable error in the price"
        />
      </Field>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? 'Voiding…' : `Void ticket (refund ${money(ticket.stake)})`}
      </Button>
    </form>
  );
}

/** Risk actions on an open ticket. Rendered only for staff with the risk role. */
export function TicketActions({ ticket }: { ticket: AdminTicket }) {
  if (ticket.status !== 'open') return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Settle a selection</CardTitle>
        </CardHeader>
        <CardContent>
          <SettleSelectionForm ticket={ticket} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Void ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <VoidTicketForm ticket={ticket} />
        </CardContent>
      </Card>
    </div>
  );
}
