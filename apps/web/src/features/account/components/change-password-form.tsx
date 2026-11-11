'use client';

import { Alert, Button, Card, Field, PasswordInput, toast } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuthForm } from '@/features/auth/components/use-auth-form';
import { useRouter } from '@/i18n/navigation';

import { changePassword } from '../actions';

/** Current + new password. Other devices are signed out; this one stays signed in. */
export function ChangePasswordForm() {
  const t = useTranslations('Account.security');
  const auth = useTranslations('Auth');
  const router = useRouter();
  const form = useAuthForm();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const visibility = { showLabel: auth('showPassword'), hideLabel: auth('hidePassword') };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">{t('passwordTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('passwordHint')}</p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit(
            () => changePassword({ currentPassword, password }),
            () => {
              setCurrentPassword('');
              setPassword('');
              toast.success(t('passwordChanged'));
              router.refresh();
            },
          );
        }}
      >
        {form.error && <Alert variant="destructive">{form.error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('currentPassword')} error={form.fieldError('currentPassword')}>
            <PasswordInput
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              {...visibility}
            />
          </Field>
          <Field
            label={t('newPassword')}
            hint={auth('fields.passwordHint')}
            error={form.fieldError('password')}
          >
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              {...visibility}
            />
          </Field>
        </div>
        <Button type="submit" className="self-start" disabled={form.pending}>
          {t('changePassword')}
        </Button>
      </form>
    </Card>
  );
}
