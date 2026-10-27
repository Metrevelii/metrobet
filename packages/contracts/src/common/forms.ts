import type { z } from 'zod';

/** `{ 'title.ka': 'Required' }`: field path → first error message. */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(
  issues: readonly Pick<z.core.$ZodIssue, 'path' | 'message'>[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message } of issues) errors[path.join('.')] ??= message;
  return errors;
}

/** Result of a Server Action: never throws to the client. */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };
