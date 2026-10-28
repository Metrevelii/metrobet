import { GAME_TYPES, type GameTag } from '@metrobet/contracts';
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const gameType = pgEnum('game_type', GAME_TYPES);
export const gameVolatility = pgEnum('game_volatility', ['low', 'medium', 'high']);

/** Studios, synced from the aggregator. `isActive` lets staff hide a whole provider. */
export const casinoProviders = pgTable('casino_providers', {
  id: uuid().primaryKey().defaultRandom(),
  externalId: text().notNull().unique('casino_providers_external_id_unique'),
  slug: text().notNull().unique('casino_providers_slug_unique'),
  name: text().notNull(),
  /** Staff curation: hide a whole provider. */
  isActive: boolean().notNull().default(true),
  /** Aggregator-owned: false when the provider is no longer in the feed. */
  isAvailable: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Game catalogue, synced from the aggregator; curation fields (isActive, tags) are ours. */
export const casinoGames = pgTable(
  'casino_games',
  {
    id: uuid().primaryKey().defaultRandom(),
    externalId: text().notNull().unique('casino_games_external_id_unique'),
    providerId: uuid()
      .notNull()
      .references(() => casinoProviders.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique('casino_games_slug_unique'),
    name: text().notNull(),
    type: gameType().notNull(),
    thumbnail: text().notNull(),
    tags: text().array().$type<GameTag[]>().notNull().default([]),
    rtp: numeric({ precision: 5, scale: 2, mode: 'number' }),
    volatility: gameVolatility(),
    hasDemo: boolean().notNull().default(true),
    hasRealMoney: boolean().notNull().default(false),
    /** Higher = more popular. From the aggregator for now, later from our own play stats. */
    popularity: integer().notNull().default(0),
    releasedAt: timestamp({ withTimezone: true }).notNull(),
    /** Staff curation: hide a game. Kept across syncs. */
    isActive: boolean().notNull().default(true),
    /** Aggregator-owned: false when the game is no longer in the feed. Visible = active AND available. */
    isAvailable: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('casino_games_provider_idx').on(table.providerId),
    index('casino_games_popularity_idx').on(table.popularity),
    index('casino_games_type_idx').on(table.type),
  ],
);

export type CasinoGameRow = typeof casinoGames.$inferSelect;
