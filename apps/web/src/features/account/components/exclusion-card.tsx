'use client';

import { type ExclusionPeriod } from '@metrobet/contracts';
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  Button,
  Card,
  Chip,
  Field,
  PasswordInput,
  toast,
} from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuthForm } from '@/features/auth/components/use-auth-form';
import { useRouter } from '@/i18n/navigation';

import { exclude } from '../actions';

const BREAKS: ExclusionPeriod[] = ['1d', '7d', '30d'];
const EXCLUSIONS: ExclusionPeriod[] = ['6m', '1y', 'permanent'];

/**
 * Take a break (1–30 days) or self-exclude (6 months and longer). Needs the password and a
 * confirmation; afterwards the player is signed out and can't sign in until it ends.
 */
export function ExclusionCard() {
  const t = useTranslations('Account.exclusion');
  const auth = useTranslations('Auth');
  const router = useRouter();
  const form = useAuthForm();
  const [period, setPeriod] = useState<ExclusionPeriod | null>(null);
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);

  const submit = () =>
    form.submit(
      () => exclude({ period, password }),
      () => {
        toast.success(t(period === 'permanent' ? 'doneForever' : 'done'), { duration: 10_000 });
        router.push('/');
        router.refresh();
      },
    );

  const group = (title: string, hint: string, periods: ExclusionPeriod[]) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <fieldset className="flex flex-wrap gap-2" aria-label={title}>
        {periods.map((item) => (
          <Chip key={item} selected={period === item} onClick={() => setPeriod(item)}>
            {t(`periods.${item}`)}
          </Chip>
        ))}
      </fieldset>
    </div>
  );

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      {group(t('breakTitle'), t('breakHint'), BREAKS)}
      {group(t('excludeTitle'), t('excludeHint'), EXCLUSIONS)}

      {period && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (password) setConfirming(true);
          }}
        >
          {form.error && <Alert variant="destructive">{form.error}</Alert>}
          <Field label={t('password')} error={form.fieldError('password')}>
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              showLabel={auth('showPassword')}
              hideLabel={auth('hidePassword')}
            />
          </Field>
          <Button
            type="submit"
            variant="destructive"
            className="self-start"
            disabled={!password || form.pending}
          >
            {t(BREAKS.includes(period) ? 'takeBreak' : 'selfExclude')}
          </Button>
        </form>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {period &&
              t(period === 'permanent' ? 'confirmForever' : 'confirmText', {
                period: t(`periods.${period}`),
              })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
