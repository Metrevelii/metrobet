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
    image: { desktop: '/d.svg', mobile: '/m.svg' },
    blocks: [{ id: 'intro', type: 'richText', title: null, body: text('content') }],
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
  readonly enrollments = new Map<string, Date>();

  constructor(private readonly items: Promotion[]) {
    super();
  }
  findEnrollment(promotionId: string, playerId: string) {
    return Promise.resolve(this.enrollments.get(`${promotionId}:${playerId}`) ?? null);
  }
  enroll(promotionId: string, playerId: string) {
    const key = `${promotionId}:${playerId}`;
    if (!this.enrollments.has(key)) this.enrollments.set(key, new Date());
    return Promise.resolve(this.enrollments.get(key)!);
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

  const optIn = { id: 'join', type: 'optIn' as const, title: text('join'), body: text('body') };
  const repository = new FakeRepository([
    promotion({ slug: 'second', sortOrder: 20 }),
    promotion({ slug: 'first', sortOrder: 10, placements: ['home', 'casino'] }),
    promotion({ slug: 'inactive', isActive: false }),
    promotion({ slug: 'expired', endsAt: '2026-10-01T00:00:00.000Z' }),
    promotion({ slug: 'upcoming', startsAt: '2026-11-01T00:00:00.000Z' }),
    promotion({ slug: 'tournament', sortOrder: 30, blocks: [optIn] }),
    promotion({ slug: 'old-tournament', blocks: [optIn], endsAt: '2026-10-01T00:00:00.000Z' }),
  ]);
  const service = new PromotionsService(repository);

  it('lists only live promotions in sort order, localized', async () => {
    const result = await service.listPublic({ locale: 'en' });
    expect(result.map((p) => p.slug)).toEqual(['first', 'second', 'tournament']);
    expect(result[0]?.title).toBe('first en');
  });

  it('filters by placement', async () => {
    const result = await service.listPublic({ locale: 'ka', placement: 'casino' });
    expect(result.map((p) => p.slug)).toEqual(['first']);
  });

  it('returns detail for a live promotion and null otherwise', async () => {
    await expect(service.findPublic('first', 'ru')).resolves.toMatchObject({
      title: 'first ru',
      requiresOptIn: false,
      blocks: [{ id: 'intro', type: 'richText', title: null, body: 'content ru' }],
    });
    await expect(service.findPublic('expired', 'en')).resolves.toBeNull();
    await expect(service.findPublic('missing', 'en')).resolves.toBeNull();
  });

  describe('enrollment', () => {
    it('opts a player in once and reports it', async () => {
      await expect(service.getEnrollment('tournament', 'p1')).resolves.toEqual({
        enrolled: false,
        enrolledAt: null,
      });
      const first = await service.enroll('tournament', 'p1');
      expect(first).toEqual({ enrolled: true, enrolledAt: now.toISOString() });
      vi.advanceTimersByTime(60_000);
      await expect(service.enroll('tournament', 'p1')).resolves.toEqual(first);
      await expect(service.getEnrollment('tournament', 'p2')).resolves.toMatchObject({
        enrolled: false,
      });
      await expect(service.findPublic('tournament', 'en')).resolves.toMatchObject({
        requiresOptIn: true,
      });
    });

    it('rejects promotions without opt-in, and ones that are not live', async () => {
      await expect(service.enroll('first', 'p1')).rejects.toThrow('does not need opt-in');
      await expect(service.enroll('old-tournament', 'p1')).rejects.toThrow('not found');
      await expect(service.getEnrollment('missing', 'p1')).rejects.toThrow('not found');
    });
  });
});
