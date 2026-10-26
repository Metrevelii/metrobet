import {
  type LocalizedText,
  PROMOTION_CATEGORIES,
  type PromotionPlacement,
} from '@metrobet/contracts';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
  content: localized(),
  terms: localized(),
  imageDesktop: text().notNull(),
  imageMobile: text().notNull(),
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
