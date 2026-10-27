'use client';

import { Alert, Button, Field, Input } from '@metrobet/ui';
import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link, useRouter } from '@/i18n/navigation';

import { confirmVerification, resendVerification } from '../actions';
import { useAuthForm } from './use-auth-form';

type VerifyFormProps = { next: string; verified: boolean };

export function VerifyForm({ next, verified }: VerifyFormProps) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const confirm = useAuthForm();
  const resend = useAuthForm();
  const [code, setCode] = useState('');
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(verified);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CircleCheck className="size-12 text-success" />
        <p className="font-semibold">{t('verify.done')}</p>
        <Button asChild size="lg" className="w-full">
          <Link href={next}>{t('verify.continue')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        confirm.submit(
          () => confirmVerification({ code }),
          () => {
            setDone(true);
            router.refresh();
          },
        );
      }}
    >
      {(confirm.error ?? resend.error) && (
        <Alert variant="destructive">{confirm.error ?? resend.error}</Alert>
      )}
      {resent && !resend.error && <Alert variant="success">{t('verify.resent')}</Alert>}
      <Field label={t('fields.code')} error={confirm.fieldError('code')}>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          className="h-12 text-center text-2xl tracking-[0.5em] tabular"
        />
      </Field>
      <Button type="submit" size="lg" disabled={confirm.pending || code.length !== 6}>
        {t('verify.submit')}
      </Button>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          disabled={resend.pending}
          onClick={() => resend.submit(resendVerification, () => setResent(true))}
          className="cursor-pointer font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {t('verify.resend')}
        </button>
        <Link href={next} className="text-muted-foreground hover:text-foreground">
          {t('verify.later')}
        </Link>
      </div>
    </form>
  );
}
