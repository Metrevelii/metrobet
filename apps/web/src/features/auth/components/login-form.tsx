'use client';

import { Alert, Button, Field, Input, PasswordInput } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link, useRouter } from '@/i18n/navigation';

import { login } from '../actions';
import { useAuthForm } from './use-auth-form';

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { pending, error, fieldError, submit } = useAuthForm();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit(
          () => login({ identifier, password }),
          () => {
            router.push(next);
            router.refresh();
          },
        );
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label={t('fields.identifier')} error={fieldError('identifier')}>
        <Input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          placeholder={t('fields.identifierHint')}
        />
      </Field>
      <Field label={t('fields.password')} error={fieldError('password')}>
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
        />
      </Field>
      <Link
        href="/forgot-password"
        className="-mt-1 self-end text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {t('login.forgot')}
      </Link>
      <Button type="submit" size="lg" disabled={pending}>
        {t('login.submit')}
      </Button>
    </form>
  );
}
