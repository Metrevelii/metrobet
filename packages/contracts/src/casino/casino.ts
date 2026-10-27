import { z } from 'zod';

import { localeSchema } from '../common/locale.js';
import { slugSchema } from '../common/slug.js';

export const GAME_TYPES = ['slot', 'crash', 'table'] as const;
export const gameTypeSchema = z.enum(GAME_TYPES);
export type GameType = z.infer<typeof gameTypeSchema>;

/** Merchandising labels shown as badges; `jackpot` also drives the Jackpots category. */
export const GAME_TAGS = ['new', 'hot', 'jackpot'] as const;
export const gameTagSchema = z.enum(GAME_TAGS);
export type GameTag = z.infer<typeof gameTagSchema>;

/**
 * Slots lobby categories. Curated by rules on the server (see the api casino module), not stored
 * per game: popular = by popularity, new / jackpots = by tag. Listings can also filter by `type`
 * (the Crash page lists `type: 'crash'`).
 */
export const CASINO_CATEGORIES = ['popular', 'new', 'jackpots'] as const;
export const casinoCategorySchema = z.enum(CASINO_CATEGORIES);
export type CasinoCategory = z.infer<typeof casinoCategorySchema>;

export const providerSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  gameCount: z.number().int(),
});
export type Provider = z.infer<typeof providerSchema>;

/** Everything a game tile needs. */
export const gameCardSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  type: gameTypeSchema,
  provider: z.object({ slug: slugSchema, name: z.string() }),
  thumbnail: z.string(),
  tags: z.array(gameTagSchema),
  hasDemo: z.boolean(),
});
export type GameCard = z.infer<typeof gameCardSchema>;

export const gameDetailSchema = gameCardSchema.extend({
  rtp: z.number().nullable(),
  volatility: z.enum(['low', 'medium', 'high']).nullable(),
});
export type GameDetail = z.infer<typeof gameDetailSchema>;

export const lobbySectionSchema = z.object({
  category: casinoCategorySchema,
  games: z.array(gameCardSchema),
});
/** The slots lobby: a row per category (slot games only) and providers that have slots. */
export const casinoLobbySchema = z.object({
  sections: z.array(lobbySectionSchema),
  providers: z.array(providerSchema),
});
export type CasinoLobby = z.infer<typeof casinoLobbySchema>;

export const GAMES_PAGE_SIZE = 24;

export const gameListQuerySchema = z.object({
  type: gameTypeSchema.optional(),
  category: casinoCategorySchema.optional(),
  provider: slugSchema.optional(),
  search: z.string().trim().min(2).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(GAMES_PAGE_SIZE),
});
export type GameListQuery = Omit<z.output<typeof gameListQuerySchema>, 'page' | 'pageSize'> & {
  page?: number;
  pageSize?: number;
};

export const gamePageSchema = z.object({
  items: z.array(gameCardSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type GamePage = z.infer<typeof gamePageSchema>;

export const GAME_MODES = ['demo', 'real'] as const;
export const gameModeSchema = z.enum(GAME_MODES);
export type GameMode = z.infer<typeof gameModeSchema>;

export const gameLaunchRequestSchema = z.object({
  mode: gameModeSchema,
  locale: localeSchema,
});
export type GameLaunchRequest = z.infer<typeof gameLaunchRequestSchema>;

export const gameLaunchResponseSchema = z.object({ url: z.url() });
export type GameLaunchResponse = z.infer<typeof gameLaunchResponseSchema>;
