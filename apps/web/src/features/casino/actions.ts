'use server';

import { type GamePage, gameListQuerySchema } from '@metrobet/contracts';

import { getGames } from './data';

/** Next page for "Load more" grids. Input comes from the browser, so it is re-validated. */
export async function loadMoreGames(query: unknown): Promise<GamePage | null> {
  const parsed = gameListQuerySchema.safeParse(query);
  if (!parsed.success) return null;
  return getGames(parsed.data);
}
