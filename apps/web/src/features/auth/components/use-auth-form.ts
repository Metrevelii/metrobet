'use client';

import type { ActionResult, FieldErrors } from '@metrobet/contracts';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

/**
 * Submit state for auth forms: runs a Server Action and exposes translated errors.
 * Field errors arrive as keys (`Auth.validation.*`), the form error as a key (`Auth.errors.*`).
 */
export function useAuthForm() {
  const t = useTranslations('Auth');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const translate = (key: string | undefined) =>
    key === undefined
      ? undefined
      : t.has(`validation.${key}` as 'validation.codeInvalid')
        ? t(`validation.${key}` as 'validation.codeInvalid')
        : key;

  function submit<T>(action: () => Promise<ActionResult<T>>, onSuccess: (data: T) => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setFieldErrors({});
        setError(null);
        onSuccess(result.data);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      // Field-level problems are shown next to the fields; only show the banner for other errors.
      setError(
        result.fieldErrors && result.error === 'generic'
          ? null
          : t(`errors.${result.error}` as 'errors.generic'),
      );
    });
  }

  return { pending, error, fieldError: (name: string) => translate(fieldErrors[name]), submit };
}
