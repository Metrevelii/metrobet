import { z } from 'zod';

import { localizedTextSchema } from '../common/localized.js';
import { localeSchema } from '../common/locale.js';
import { slugSchema } from '../common/slug.js';
import { PROMO_BLOCKS_MAX, promoBlockSchema, promoBlockViewSchema } from './blocks.js';

/** Product area a promotion belongs to; drives the badge and filtering. */
export const PROMOTION_CATEGORIES = ['casino', 'sports', 'crash', 'general'] as const;
export const promotionCategorySchema = z.enum(PROMOTION_CATEGORIES);
export type PromotionCategory = z.infer<typeof promotionCategorySchema>;

/** Pages that render a promo slider. A promotion can appear on several. */
export const PROMOTION_PLACEMENTS = ['home', 'sports', 'live', 'casino', 'crash'] as const;
export const promotionPlacementSchema = z.enum(PROMOTION_PLACEMENTS);
export type PromotionPlacement = z.infer<typeof promotionPlacementSchema>;

/** Text-free artwork: copy is rendered as HTML on top, so one image serves every locale. */
export const promotionImageSchema = z.object({
  desktop: z.string().min(1, 'Upload an image'),
  mobile: z.string().min(1, 'Upload an image'),
});

/** Full promotion as stored and edited in the backoffice. `blocks` is its page, top to bottom. */
export const promotionSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  category: promotionCategorySchema,
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  ctaLabel: localizedTextSchema,
  /** Where the CTA goes. Null means the promotion's own page. */
  ctaHref: z.string().nullable(),
  image: promotionImageSchema,
  blocks: z.array(promoBlockSchema),
  placements: z.array(promotionPlacementSchema),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** Derived, never stored: where a promotion is in its lifecycle at a point in time. */
export const PROMOTION_STATUSES = ['live', 'scheduled', 'expired', 'inactive'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export function getPromotionStatus(
  promotion: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>,
  now: number = Date.now(),
): PromotionStatus {
  if (!promotion.isActive) return 'inactive';
  if (promotion.startsAt && Date.parse(promotion.startsAt) > now) return 'scheduled';
  if (promotion.endsAt && Date.parse(promotion.endsAt) <= now) return 'expired';
  return 'live';
}

/** Create/update payload from the backoffice. `id` and `sortOrder` are owned by the server. */
export const promotionInputSchema = promotionSchema
  .omit({ id: true, sortOrder: true })
  .extend({
    ctaHref: z
      .string()
      .trim()
      .regex(/^(\/|https:\/\/)/, 'Must start with / or https://')
      .nullable(),
    placements: z.array(promotionPlacementSchema).min(1, 'Pick at least one placement'),
    blocks: z.array(promoBlockSchema).max(PROMO_BLOCKS_MAX),
  })
  .superRefine(({ startsAt, endsAt, blocks }, ctx) => {
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
    }
    const ids = new Set<string>();
    let optIns = 0;
    blocks.forEach((item, index) => {
      if (ids.has(item.id)) {
        ctx.addIssue({ code: 'custom', path: ['blocks', index], message: 'Duplicate block id' });
      }
      ids.add(item.id);
      if (item.type === 'countdown' && !endsAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['blocks', index],
          message: 'A countdown needs an end date (Schedule)',
        });
      }
      if (item.type === 'optIn' && (optIns += 1) > 1) {
        ctx.addIssue({ code: 'custom', path: ['blocks', index], message: 'Only one opt-in block' });
      }
    });
  });
export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const promotionActiveInputSchema = z.object({ isActive: z.boolean() });
export type PromotionActiveInput = z.infer<typeof promotionActiveInputSchema>;

/** Full display order: every promotion id, first to last. */
export const promotionReorderInputSchema = z.object({ ids: z.array(z.string()).min(1) });
export type PromotionReorderInput = z.infer<typeof promotionReorderInputSchema>;

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
  /** Players must opt in (the page has an opt-in block). */
  requiresOptIn: z.boolean(),
  blocks: z.array(promoBlockViewSchema),
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

/** The signed-in player's opt-in state for one promotion. */
export const promotionEnrollmentSchema = z.object({
  enrolled: z.boolean(),
  enrolledAt: z.iso.datetime().nullable(),
});
export type PromotionEnrollment = z.infer<typeof promotionEnrollmentSchema>;
