import { type ActionResult, toFieldErrors } from '@metrobet/contracts';
import { revalidatePath } from 'next/cache';

import { AdminApiError } from './admin-api';

/**
 * Runs an admin mutation for a Server Action: revalidates `paths` on success and turns API errors
 * into an ActionResult (never throws to the client).
 */
export async function runAction<T>(
  paths: string[],
  mutation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await mutation();
    for (const path of paths) revalidatePath(path);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AdminApiError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: toFieldErrors(
          error.issues.map(({ path, message }) => ({ path: path.split('.'), message })),
        ),
      };
    }
    console.error('[backoffice] action failed', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
