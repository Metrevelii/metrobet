import { z } from 'zod';

import { localizedTextSchema } from '../common/localized.js';
import { localeSchema } from '../common/locale.js';

/** Product area a promotion belongs to; drives the badge and filtering. */
export const PROMOTION_CATEGORIES = ['casino', 'sports', 'crash', 'general'] as const;
export const promotionCategorySchema = z.enum(PROMOTION_CATEGORIES);
export type PromotionCategory = z.infer<typeof promotionCategorySchema>;

/** Pages that render a promo slider. A promotion can appear on several. */
export const PROMOTION_PLACEMENTS = ['home', 'sports', 'live', 'casino', 'crash'] as const;
export const promotionPlacementSchema = z.enum(PROMOTION_PLACEMENTS);
export type PromotionPlacement = z.infer<typeof promotionPlacementSchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

/** Text-free artwork: copy is rendered as HTML on top, so one image serves every locale. */
export const promotionImageSchema = z.object({
  desktop: z.string().min(1),
  mobile: z.string().min(1),
});

/**
 * Full promotion as stored and edited in the backoffice.
 * `content` paragraphs are separated by blank lines; `terms` has one rule per line.
 */
export const promotionSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  category: promotionCategorySchema,
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  ctaLabel: localizedTextSchema,
  /** Where the CTA goes. Null means the promotion's own page. */
  ctaHref: z.string().nullable(),
  content: localizedTextSchema,
  terms: localizedTextSchema,
  image: promotionImageSchema,
  placements: z.array(promotionPlacementSchema),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** Slider/list item, already localized by the API. */
export const promotionCardSchema = z.object({
  slug: slugSchema,
  category: promotionCategorySchema,
  title: z.string(),
  subtitle: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string().nullable(),
  image: promotionImageSchema,
  endsAt: z.iso.datetime().nullable(),
});
export type PromotionCard = z.infer<typeof promotionCardSchema>;

/** Promotion page payload, already localized by the API. */
export const promotionDetailSchema = promotionCardSchema.extend({
  content: z.string(),
  terms: z.string(),
});
export type PromotionDetail = z.infer<typeof promotionDetailSchema>;

export const promotionListQuerySchema = z.object({
  locale: localeSchema,
  placement: promotionPlacementSchema.optional(),
});
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;

export const promotionDetailQuerySchema = z.object({
  locale: localeSchema,
});
export type PromotionDetailQuery = z.infer<typeof promotionDetailQuerySchema>;
