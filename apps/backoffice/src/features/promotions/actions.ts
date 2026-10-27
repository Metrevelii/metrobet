'use server';

import {
  type GameCard,
  gamePageSchema,
  MEDIA_MAX_BYTES,
  mediaUploadResponseSchema,
  type Promotion,
  promotionInputSchema,
  promotionSchema,
} from '@metrobet/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { AdminApiError, adminFetch, API_URL } from '@/lib/admin-api';
import { type ActionResult, toFieldErrors } from '@metrobet/contracts';

const LIST_PATH = '/promotions';

async function run<T>(mutation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await mutation();
    revalidatePath(LIST_PATH);
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
    console.error('[promotions] action failed', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

/** Creates (id = null) or replaces a promotion. Input is re-validated here, never trusted. */
export async function savePromotion(
  id: string | null,
  input: unknown,
): Promise<ActionResult<Promotion>> {
  const parsed = promotionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  return run(() =>
    adminFetch(id ? `promotions/${id}` : 'promotions', promotionSchema, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}

export async function setPromotionActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult<Promotion>> {
  return run(() =>
    adminFetch(`promotions/${id}/active`, promotionSchema, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  );
}

export async function reorderPromotions(ids: string[]): Promise<ActionResult<Promotion[]>> {
  return run(() =>
    adminFetch('promotions/order', promotionSchema.array(), {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
  );
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminFetch(`promotions/${id}`, z.undefined(), { method: 'DELETE' });
  });
}

/** Uploads promotion artwork; returns its public URL. */
export async function uploadPromotionImage(formData: FormData): Promise<ActionResult<string>> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Choose an image file.' };
  if (file.size > MEDIA_MAX_BYTES) return { ok: false, error: 'Image must be 5 MB or smaller.' };

  const body = new FormData();
  body.append('file', file);
  return run(async () => {
    const { url } = await adminFetch('media/promotions', mediaUploadResponseSchema, {
      method: 'POST',
      body,
    });
    return url;
  });
}

/** Slot games matching `query` (name), for the wheel's free-spins game picker. */
export async function searchSlotGames(query: unknown): Promise<GameCard[]> {
  const search = z.string().trim().min(2).max(50).safeParse(query);
  if (!search.success) return [];
  const url = new URL(`${API_URL}/casino/games`);
  url.search = new URLSearchParams({
    type: 'slot',
    search: search.data,
    pageSize: '20',
  }).toString();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];
    return gamePageSchema.parse(await response.json()).items;
  } catch (error) {
    console.error('[promotions] Game search failed', error);
    return [];
  }
}
