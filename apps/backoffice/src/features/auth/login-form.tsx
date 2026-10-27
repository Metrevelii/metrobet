'use client';

import type { FieldErrors } from '@metrobet/contracts';
import { Alert, Button, Field, Input, PasswordInput } from '@metrobet/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { login } from './actions';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await login({ email, password });
          if (result.ok) {
            router.push(next);
            router.refresh();
          } else {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label="Work email" error={fieldErrors.email}>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
        />
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
