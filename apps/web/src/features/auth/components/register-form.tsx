'use client';

import { Alert, Button, Checkbox, Field, Input, PasswordInput } from '@metrobet/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { useRouter } from '@/i18n/navigation';

import { register } from '../actions';
import { useAuthForm } from './use-auth-form';

type RegisterFormProps = {
  next: string;
  /** Latest allowed birth date (YYYY-MM-DD), computed on the server for the date picker. */
  maxBirthDate: string;
};

export function RegisterForm({ next, maxBirthDate }: RegisterFormProps) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const termsId = useId();
  const { pending, error, fieldError, submit } = useAuthForm();
  const [form, setForm] = useState({
    identifier: '',
    password: '',
    dateOfBirth: '',
    acceptTerms: false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const termsError = fieldError('acceptTerms');

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit(
          () => register({ ...form, locale }),
          () => {
            router.push(`/verify?next=${encodeURIComponent(next)}`);
            router.refresh();
          },
        );
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field
        label={t('fields.identifier')}
        error={fieldError('identifier')}
        hint={t('fields.identifierHint')}
      >
        <Input
          value={form.identifier}
          onChange={(event) => set('identifier', event.target.value)}
          autoComplete="username"
        />
      </Field>
      <Field
        label={t('fields.password')}
        error={fieldError('password')}
        hint={t('fields.passwordHint')}
      >
        <PasswordInput
          value={form.password}
          onChange={(event) => set('password', event.target.value)}
          autoComplete="new-password"
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
        />
      </Field>
      <Field label={t('fields.dateOfBirth')} error={fieldError('dateOfBirth')}>
        <Input
          type="date"
          value={form.dateOfBirth}
          max={maxBirthDate}
          onChange={(event) => set('dateOfBirth', event.target.value)}
          autoComplete="bday"
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Checkbox
            id={termsId}
            checked={form.acceptTerms}
            onCheckedChange={(checked) => set('acceptTerms', checked === true)}
            aria-invalid={termsError ? true : undefined}
            className="mt-0.5"
          />
          <label
            htmlFor={termsId}
            className="cursor-pointer text-xs leading-relaxed text-muted-foreground"
          >
            {t('register.terms')}
          </label>
        </div>
        {termsError && (
          <p role="alert" className="text-xs text-destructive">
            {termsError}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {t('register.submit')}
      </Button>
    </form>
  );
}
