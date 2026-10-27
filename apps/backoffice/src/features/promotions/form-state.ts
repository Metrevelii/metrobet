import {
  LOCALES,
  type Locale,
  type LocalizedText,
  type PromoBlock,
  type PromoBlockOf,
  type PromoBlockType,
  type Promotion,
  type PromotionCategory,
  type PromotionInput,
  type PromotionPlacement,
  type PromotionStatus,
  toMinor,
} from '@metrobet/contracts';

export const CATEGORY_LABELS: Record<PromotionCategory, string> = {
  general: 'Bonus',
  casino: 'Casino',
  sports: 'Sports',
  crash: 'Crash',
};

export const PLACEMENT_LABELS: Record<PromotionPlacement, string> = {
  home: 'Home',
  sports: 'Sports',
  live: 'Live',
  casino: 'Slots',
  crash: 'Crash',
};

export const LOCALE_LABELS: Record<Locale, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};

export const STATUS_LABELS: Record<PromotionStatus, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
  inactive: 'Off',
};

export const LOCALIZED_FIELDS = ['title', 'subtitle', 'ctaLabel'] as const;
export type LocalizedField = (typeof LOCALIZED_FIELDS)[number];

/** Page builder menu: label + one-line description per block type, in menu order. */
export const BLOCK_LABELS: Record<PromoBlockType, { label: string; description: string }> = {
  optIn: { label: 'Opt-in', description: 'Join button. Players must join to take part.' },
  countdown: { label: 'Countdown', description: 'Time left until the end date.' },
  steps: { label: 'Steps', description: 'How to take part, up to 6 steps.' },
  richText: { label: 'Text', description: 'Paragraphs with an optional heading.' },
  prizes: { label: 'Prizes', description: 'Places or tiers and what they win.' },
  faq: { label: 'FAQ', description: 'Questions and answers.' },
  terms: { label: 'Terms', description: 'Terms & conditions, one rule per line.' },
  wheel: { label: 'Prize wheel', description: 'Spins earned by wagering; wins free spins.' },
};

/** Draft blocks: a rich-text heading is always a LocalizedText here ('' everywhere = none). */
export type PromoBlockDraft =
  | Exclude<PromoBlock, { type: 'richText' }>
  | (Omit<PromoBlockOf<'richText'>, 'title'> & { title: LocalizedText });

/** Form state: like PromotionInput, but with input-friendly strings for optional values. */
export type PromotionDraft = Omit<PromotionInput, 'ctaHref' | 'startsAt' | 'endsAt' | 'blocks'> & {
  ctaHref: string;
  /** `YYYY-MM-DDTHH:mm` in the browser's time zone (datetime-local), or ''. */
  startsAt: string;
  endsAt: string;
  blocks: PromoBlockDraft[];
};

export const emptyText = (): LocalizedText =>
  Object.fromEntries(LOCALES.map((locale) => [locale, ''])) as LocalizedText;

const isEmptyText = (text: LocalizedText) => LOCALES.every((locale) => !text[locale].trim());

/** Empty list item for blocks that have items. */
export const BLOCK_ITEMS = {
  steps: () => ({ title: emptyText(), text: emptyText() }),
  prizes: () => ({ label: emptyText(), prize: emptyText() }),
  faq: () => ({ question: emptyText(), answer: emptyText() }),
};
export type BlockWithItems = keyof typeof BLOCK_ITEMS;

export function newBlock(type: PromoBlockType): PromoBlockDraft {
  const id = crypto.randomUUID();
  switch (type) {
    case 'richText':
      return { id, type, title: emptyText(), body: emptyText() };
    case 'steps':
    case 'prizes':
    case 'faq':
      return { id, type, title: emptyText(), items: [BLOCK_ITEMS[type]()] } as PromoBlockDraft;
    case 'countdown':
      return { id, type, title: emptyText() };
    case 'terms':
      return { id, type, body: emptyText() };
    case 'optIn':
      return { id, type, title: emptyText(), body: emptyText() };
    case 'wheel':
      return {
        id,
        type,
        title: emptyText(),
        earn: { stepAmount: toMinor(50), gameTypes: ['slot'] },
        freeSpinsGame: '',
        segments: [5, 10, 5, 20, 5, 10, 5, 50].map((freeSpins) => ({
          freeSpins,
          weight: Math.round(1000 / freeSpins),
        })),
      };
  }
}

export function emptyDraft(): PromotionDraft {
  return {
    slug: '',
    category: 'general',
    title: emptyText(),
    subtitle: emptyText(),
    ctaLabel: emptyText(),
    ctaHref: '',
    image: { desktop: '', mobile: '' },
    blocks: [newBlock('richText'), newBlock('terms')],
    placements: ['home'],
    isActive: false,
    startsAt: '',
    endsAt: '',
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function draftFromPromotion({
  id: _id,
  sortOrder: _sortOrder,
  ...promotion
}: Promotion): PromotionDraft {
  return {
    ...promotion,
    ctaHref: promotion.ctaHref ?? '',
    startsAt: toLocalInput(promotion.startsAt),
    endsAt: toLocalInput(promotion.endsAt),
    blocks: promotion.blocks.map((block) =>
      block.type === 'richText' ? { ...block, title: block.title ?? emptyText() } : block,
    ),
  };
}

export function draftToInput(draft: PromotionDraft): PromotionInput {
  return {
    ...draft,
    ctaHref: draft.ctaHref.trim() || null,
    startsAt: fromLocalInput(draft.startsAt),
    endsAt: fromLocalInput(draft.endsAt),
    blocks: draft.blocks.map((block) =>
      block.type === 'richText' && isEmptyText(block.title) ? { ...block, title: null } : block,
    ),
  };
}

/** URL-safe slug from a title (Latin only; Georgian/Russian titles need a manual slug). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}
