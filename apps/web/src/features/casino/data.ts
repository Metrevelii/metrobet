import {
  type CasinoLobby,
  casinoLobbySchema,
  type GameDetail,
  gameDetailSchema,
  type GameListQuery,
  type GameMode,
  gameLaunchResponseSchema,
  type GamePage,
  gamePageSchema,
  type Locale,
  type Provider,
  providerSchema,
} from '@metrobet/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { ApiError, apiGet, apiPost } from '@/lib/api';

/** Revalidate when the catalogue changes (aggregator sync, backoffice curation). */
export const CASINO_CACHE_TAG = 'casino';

const EMPTY_LOBBY: CasinoLobby = { sections: [], providers: [] };

/** Lobby rows + providers. Never throws: an outage renders an empty lobby. */
export async function getLobby(): Promise<CasinoLobby> {
  'use cache';
  cacheTag(CASINO_CACHE_TAG);
  try {
    const lobby = await apiGet('casino/lobby', casinoLobbySchema);
    cacheLife('minutes');
    return lobby;
  } catch (error) {
    console.error('[casino] Failed to load lobby', error);
    cacheLife('seconds');
    return EMPTY_LOBBY;
  }
}

/** A page of games for a category / provider / search, or null when the API is unavailable. */
export async function getGames(query: GameListQuery): Promise<GamePage | null> {
  'use cache';
  cacheTag(CASINO_CACHE_TAG);
  try {
    const page = await apiGet('casino/games', gamePageSchema, query);
    cacheLife('minutes');
    return page;
  } catch (error) {
    console.error('[casino] Failed to load games', error);
    cacheLife('seconds');
    return null;
  }
}

export async function getProviders(): Promise<Provider[]> {
  'use cache';
  cacheTag(CASINO_CACHE_TAG);
  try {
    const providers = await apiGet('casino/providers', providerSchema.array());
    cacheLife('minutes');
    return providers;
  } catch (error) {
    console.error('[casino] Failed to load providers', error);
    cacheLife('seconds');
    return [];
  }
}

export async function getGame(slug: string): Promise<GameDetail | null> {
  'use cache';
  cacheTag(CASINO_CACHE_TAG);
  try {
    const game = await apiGet(`casino/games/${encodeURIComponent(slug)}`, gameDetailSchema);
    cacheLife('minutes');
    return game;
  } catch (error) {
    if (error instanceof ApiError && [400, 404].includes(error.status)) {
      cacheLife('minutes');
      return null;
    }
    cacheLife('seconds');
    throw error;
  }
}

/** Creates a fresh game session (never cached). Returns null when the provider refuses. */
export async function launchGame(
  slug: string,
  mode: GameMode,
  locale: Locale,
): Promise<string | null> {
  try {
    const { url } = await apiPost(
      `casino/games/${encodeURIComponent(slug)}/launch`,
      gameLaunchResponseSchema,
      {
        mode,
        locale,
      },
    );
    return url;
  } catch (error) {
    console.error(`[casino] Failed to launch ${slug}`, error);
    return null;
  }
}
