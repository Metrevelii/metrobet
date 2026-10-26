import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

const bodySchema = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(20) });

function isAuthorized(request: Request): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get('x-revalidate-secret');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

/**
 * Called by @metrobet/api after backoffice changes: `POST { tags: ['promotions'] }` with the
 * shared `x-revalidate-secret` header. The next request for that data renders fresh content.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ message: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Invalid body' }, { status: 400 });

  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: parsed.data.tags });
}
