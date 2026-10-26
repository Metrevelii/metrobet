import type { Promotion } from '@metrobet/contracts';

import { PromotionsRepository } from './promotions.repository.js';
import { PromotionsService } from './promotions.service.js';

const text = (value: string) => ({ ka: `${value} ka`, en: `${value} en`, ru: `${value} ru` });

function promotion(overrides: Partial<Promotion> & Pick<Promotion, 'slug'>): Promotion {
  return {
    id: overrides.slug,
    category: 'general',
    title: text(overrides.slug),
    subtitle: text('subtitle'),
    ctaLabel: text('cta'),
    ctaHref: null,
    content: text('content'),
    terms: text('terms'),
    image: { desktop: '/d.svg', mobile: '/m.svg' },
    placements: ['home'],
    sortOrder: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

const unused = () => Promise.reject(new Error('not used by PromotionsService'));

class FakeRepository extends PromotionsRepository {
  constructor(private readonly items: Promotion[]) {
    super();
  }
  findAll() {
    return Promise.resolve(this.items);
  }
  findBySlug(slug: string) {
    return Promise.resolve(this.items.find((item) => item.slug === slug) ?? null);
  }
  findById = unused;
  create = unused;
  update = unused;
  setActive = unused;
  reorder = unused;
  delete = unused;
}

describe('PromotionsService', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  const service = new PromotionsService(
    new FakeRepository([
      promotion({ slug: 'second', sortOrder: 20 }),
      promotion({ slug: 'first', sortOrder: 10, placements: ['home', 'casino'] }),
      promotion({ slug: 'inactive', isActive: false }),
      promotion({ slug: 'expired', endsAt: '2026-10-01T00:00:00.000Z' }),
      promotion({ slug: 'upcoming', startsAt: '2026-11-01T00:00:00.000Z' }),
    ]),
  );

  it('lists only live promotions in sort order, localized', async () => {
    const result = await service.listPublic({ locale: 'en' });
    expect(result.map((p) => p.slug)).toEqual(['first', 'second']);
    expect(result[0]?.title).toBe('first en');
  });

  it('filters by placement', async () => {
    const result = await service.listPublic({ locale: 'ka', placement: 'casino' });
    expect(result.map((p) => p.slug)).toEqual(['first']);
  });

  it('returns detail for a live promotion and null otherwise', async () => {
    await expect(service.findPublic('first', 'ru')).resolves.toMatchObject({
      title: 'first ru',
      content: 'content ru',
    });
    await expect(service.findPublic('expired', 'en')).resolves.toBeNull();
    await expect(service.findPublic('missing', 'en')).resolves.toBeNull();
  });
});
