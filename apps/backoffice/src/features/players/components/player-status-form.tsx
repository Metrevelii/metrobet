'use client';

import { type AdminPlayer, PLAYER_STATUSES } from '@metrobet/contracts';
import { Alert, Button, Field, NativeSelect, Textarea } from '@metrobet/ui';
import { useState, useTransition } from 'react';

import { setPlayerStatus } from '../actions';

const LABELS = { active: 'Active', suspended: 'Suspended', self_excluded: 'Self-excluded' };

/** Change a player's status with a required reason (audit log). */
export function PlayerStatusForm({ player }: { player: AdminPlayer }) {
  const [status, setStatus] = useState(player.status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await setPlayerStatus(player.id, { status, reason });
      if (result.ok) {
        setReason('');
        setError(null);
        setFieldError(undefined);
        setDone(true);
      } else {
        setError(result.error);
        setFieldError(result.fieldErrors?.reason);
        setDone(false);
      }
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label="Status" hint="Suspended and self-excluded players are signed out everywhere.">
        <NativeSelect
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as AdminPlayer['status']);
            setDone(false);
          }}
        >
          {PLAYER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Reason" error={fieldError} hint="Stored in the audit log.">
        <Textarea
          value={reason}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Player asked for a 6-month self-exclusion"
        />
      </Field>
      {error && <Alert variant="destructive">{error}</Alert>}
      {done && <Alert>Status saved.</Alert>}
      <Button type="submit" disabled={pending || status === player.status}>
        {pending ? 'Saving…' : 'Save status'}
      </Button>
    </form>
  );
}
