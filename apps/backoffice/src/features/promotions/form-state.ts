import {
  LOCALES,
  type Locale,
  type LocalizedText,
  type Promotion,
  type PromotionCategory,
  type PromotionInput,
  type PromotionPlacement,
  type PromotionStatus,
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
  casino: 'Casino',
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

export const LOCALIZED_FIELDS = ['title', 'subtitle', 'ctaLabel', 'content', 'terms'] as const;
export type LocalizedField = (typeof LOCALIZED_FIELDS)[number];

/** Form state: like PromotionInput, but with input-friendly strings for optional values. */
export type PromotionDraft = Omit<PromotionInput, 'ctaHref' | 'startsAt' | 'endsAt'> & {
  ctaHref: string;
  /** `YYYY-MM-DDTHH:mm` in the browser's time zone (datetime-local), or ''. */
  startsAt: string;
  endsAt: string;
};

const emptyText = (): LocalizedText =>
  Object.fromEntries(LOCALES.map((locale) => [locale, ''])) as LocalizedText;

export function emptyDraft(): PromotionDraft {
  return {
    slug: '',
    category: 'general',
    title: emptyText(),
    subtitle: emptyText(),
    ctaLabel: emptyText(),
    ctaHref: '',
    content: emptyText(),
    terms: emptyText(),
    image: { desktop: '', mobile: '' },
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
  };
}

export function draftToInput(draft: PromotionDraft): PromotionInput {
  return {
    ...draft,
    ctaHref: draft.ctaHref.trim() || null,
    startsAt: fromLocalInput(draft.startsAt),
    endsAt: fromLocalInput(draft.endsAt),
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
