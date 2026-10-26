import type { z } from 'zod';

export type FieldErrors = Record<string, string>;

/** Flattens Zod issues to `{ 'title.ka': 'message' }`, keeping the first message per field. */
export function toFieldErrors(
  issues: readonly Pick<z.core.$ZodIssue, 'path' | 'message'>[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message } of issues) errors[path.join('.')] ??= message;
  return errors;
}
