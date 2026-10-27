'use client';

import { Alert, Button, Field, Input, PasswordInput } from '@metrobet/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link } from '@/i18n/navigation';

import { forgotPassword, resetPassword } from '../actions';
import { useAuthForm } from './use-auth-form';

/** Two steps: request a code for an email/phone, then set a new password with it. */
export function ForgotPasswordForm() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const request = useAuthForm();
  const reset = useAuthForm();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{t('forgot.done')}</Alert>
        <Button asChild size="lg">
          <Link href="/login">{t('login.submit')}</Link>
        </Button>
      </div>
    );
  }

  if (step === 'request') {
    return (
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          request.submit(
            () => forgotPassword({ identifier, locale }),
            () => setStep('reset'),
          );
        }}
      >
        {request.error && <Alert variant="destructive">{request.error}</Alert>}
        <Field label={t('fields.identifier')} error={request.fieldError('identifier')}>
          <Input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
        </Field>
        <Button type="submit" size="lg" disabled={request.pending}>
          {t('forgot.send')}
        </Button>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        reset.submit(
          () => resetPassword({ identifier, code, password }),
          () => setStep('done'),
        );
      }}
    >
      <Alert>{t('forgot.codeSent', { contact: identifier })}</Alert>
      {reset.error && <Alert variant="destructive">{reset.error}</Alert>}
      <Field label={t('fields.code')} error={reset.fieldError('code')}>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center tracking-[0.4em] tabular"
        />
      </Field>
      <Field
        label={t('forgot.newPassword')}
        error={reset.fieldError('password')}
        hint={t('fields.passwordHint')}
      >
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
        />
      </Field>
      <Button type="submit" size="lg" disabled={reset.pending}>
        {t('forgot.submit')}
      </Button>
    </form>
  );
}
