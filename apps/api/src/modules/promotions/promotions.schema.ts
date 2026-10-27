import {
  type LocalizedText,
  type PromoBlock,
  PROMOTION_CATEGORIES,
  type PromotionPlacement,
} from '@metrobet/contracts';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

export const promotionCategory = pgEnum('promotion_category', PROMOTION_CATEGORIES);

const localized = () => jsonb().$type<LocalizedText>().notNull();

export const promotions = pgTable('promotions', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique('promotions_slug_unique'),
  category: promotionCategory().notNull(),
  title: localized(),
  subtitle: localized(),
  ctaLabel: localized(),
  ctaHref: text(),
  imageDesktop: text().notNull(),
  imageMobile: text().notNull(),
  /** The promotion page, top to bottom. Validated by `promoBlockSchema` on the way in. */
  blocks: jsonb().$type<PromoBlock[]>().notNull().default([]),
  placements: text().array().$type<PromotionPlacement[]>().notNull(),
  sortOrder: integer().notNull(),
  isActive: boolean().notNull().default(false),
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PromotionRow = typeof promotions.$inferSelect;
export type NewPromotionRow = typeof promotions.$inferInsert;

/** Players who opted in to a promotion. Enrolling twice is a no-op. */
export const promotionEnrollments = pgTable(
  'promotion_enrollments',
  {
    promotionId: uuid()
      .notNull()
      .references(() => promotions.id, { onDelete: 'cascade' }),
    playerId: uuid()
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.promotionId, table.playerId] })],
);
