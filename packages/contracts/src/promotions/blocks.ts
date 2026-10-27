import { z } from 'zod';

import { gameTypeSchema } from '../casino/casino.js';
import { type Locale } from '../common/locale.js';
import { localize, localizedTextSchema } from '../common/localized.js';
import { minorAmountSchema } from '../common/money.js';

/**
 * Promo page blocks: a promotion's page is an ordered list of these, configured in the
 * backoffice. Each block has a stored shape (all copy in every locale) and a view shape (copy
 * already localized by the API). Adding a block type: schema + view + `localizePromoBlock` case
 * here, then a renderer on the site and an editor in the backoffice.
 */
export const PROMO_BLOCK_TYPES = [
  'richText',
  'steps',
  'countdown',
  'prizes',
  'faq',
  'terms',
  'optIn',
  'wheel',
] as const;
export type PromoBlockType = (typeof PROMO_BLOCK_TYPES)[number];

export const PROMO_BLOCKS_MAX = 30;
const ITEMS_MAX = 50;

const text = localizedTextSchema;
const block = <T extends PromoBlockType, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ id: z.string().min(1).max(64), type: z.literal(type), ...shape });
const items = <S extends z.ZodRawShape>(shape: S) =>
  z.array(z.object(shape)).min(1, 'Add at least one item').max(ITEMS_MAX);

/** Paragraphs separated by blank lines, with an optional heading. */
export const richTextBlockSchema = block('richText', { title: text.nullable(), body: text });
/** "How to take part": numbered steps. */
export const stepsBlockSchema = block('steps', {
  title: text,
  items: items({ title: text, text: text }).max(6),
});
/** Time left until the promotion's `endsAt` (required when this block is used). */
export const countdownBlockSchema = block('countdown', { title: text });
/** Prize table: `label` is the place or tier ("1st place"), `prize` what it wins. */
export const prizesBlockSchema = block('prizes', {
  title: text,
  items: items({ label: text, prize: text }),
});
export const faqBlockSchema = block('faq', {
  title: text,
  items: items({ question: text, answer: text }),
});
/** One rule per line. The heading is the site's own "Terms & conditions". */
export const termsBlockSchema = block('terms', { body: text });
/** Join button. Its presence is what makes a promotion require opt-in (at most one per page). */
export const optInBlockSchema = block('optIn', { title: text, body: text });

export const WHEEL_SEGMENTS_MIN = 4;
export const WHEEL_SEGMENTS_MAX = 12;

/**
 * Prize wheel (mechanic). Players earn one spin per `earn.stepAmount` wagered on `earn.gameTypes`
 * (e.g. 50 ₾ on slots = 1 spin, 100 ₾ = 2). Each segment wins free spins on `freeSpinsGame`;
 * the server picks the segment by `weight`. Weights never leave the API.
 */
export const wheelBlockSchema = block('wheel', {
  title: text,
  earn: z.object({
    stepAmount: minorAmountSchema,
    gameTypes: z.array(gameTypeSchema).min(1, 'Pick at least one game type'),
  }),
  freeSpinsGame: z.string().min(1, 'Pick the game for the free spins'),
  segments: z
    .array(
      z.object({
        freeSpins: z.number().int().min(1).max(1000),
        weight: z.number().int().min(1).max(10_000),
      }),
    )
    .min(WHEEL_SEGMENTS_MIN, `At least ${WHEEL_SEGMENTS_MIN} segments`)
    .max(WHEEL_SEGMENTS_MAX, `At most ${WHEEL_SEGMENTS_MAX} segments`),
});

export const promoBlockSchema = z.discriminatedUnion('type', [
  richTextBlockSchema,
  stepsBlockSchema,
  countdownBlockSchema,
  prizesBlockSchema,
  faqBlockSchema,
  termsBlockSchema,
  optInBlockSchema,
  wheelBlockSchema,
]);
export type PromoBlock = z.infer<typeof promoBlockSchema>;
export type PromoBlockOf<T extends PromoBlockType> = Extract<PromoBlock, { type: T }>;

/** Whether players must opt in before taking part (derived from the blocks, never stored). */
export const requiresOptIn = (blocks: readonly PromoBlock[]) =>
  blocks.some((item) => item.type === 'optIn');

// Views: the same shapes with plain strings.

const view = <T extends PromoBlockType, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ id: z.string(), type: z.literal(type), ...shape });
const viewItems = <S extends z.ZodRawShape>(shape: S) => z.array(z.object(shape));

export const promoBlockViewSchema = z.discriminatedUnion('type', [
  view('richText', { title: z.string().nullable(), body: z.string() }),
  view('steps', { title: z.string(), items: viewItems({ title: z.string(), text: z.string() }) }),
  view('countdown', { title: z.string() }),
  view('prizes', { title: z.string(), items: viewItems({ label: z.string(), prize: z.string() }) }),
  view('faq', {
    title: z.string(),
    items: viewItems({ question: z.string(), answer: z.string() }),
  }),
  view('terms', { body: z.string() }),
  view('optIn', { title: z.string(), body: z.string() }),
  view('wheel', {
    title: z.string(),
    earn: wheelBlockSchema.shape.earn,
    freeSpinsGame: z.string(),
    segments: z.array(z.object({ freeSpins: z.number() })),
  }),
]);
export type PromoBlockView = z.infer<typeof promoBlockViewSchema>;
export type PromoBlockViewOf<T extends PromoBlockType> = Extract<PromoBlockView, { type: T }>;

export function localizePromoBlock(item: PromoBlock, locale: Locale): PromoBlockView {
  const l = (value: Parameters<typeof localize>[0]) => localize(value, locale);
  switch (item.type) {
    case 'richText':
      return { ...item, title: item.title && l(item.title), body: l(item.body) };
    case 'steps':
      return {
        ...item,
        title: l(item.title),
        items: item.items.map((step) => ({ title: l(step.title), text: l(step.text) })),
      };
    case 'countdown':
      return { ...item, title: l(item.title) };
    case 'prizes':
      return {
        ...item,
        title: l(item.title),
        items: item.items.map((prize) => ({ label: l(prize.label), prize: l(prize.prize) })),
      };
    case 'faq':
      return {
        ...item,
        title: l(item.title),
        items: item.items.map((qa) => ({ question: l(qa.question), answer: l(qa.answer) })),
      };
    case 'terms':
      return { ...item, body: l(item.body) };
    case 'optIn':
      return { ...item, title: l(item.title), body: l(item.body) };
    case 'wheel':
      return {
        ...item,
        title: l(item.title),
        segments: item.segments.map(({ freeSpins }) => ({ freeSpins })),
      };
  }
}
