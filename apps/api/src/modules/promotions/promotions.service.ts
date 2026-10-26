import type {
  Locale,
  PromotionCard,
  PromotionDetail,
  PromotionListQuery,
} from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { isLive, toCard, toDetail } from './promotions.mapper.js';
import { PromotionsRepository } from './promotions.repository.js';

@Injectable()
export class PromotionsService {
  constructor(@Inject(PromotionsRepository) private readonly repository: PromotionsRepository) {}

  /** Live promotions for a placement (or all), in backoffice sort order. */
  async listPublic({ locale, placement }: PromotionListQuery): Promise<PromotionCard[]> {
    const now = Date.now();
    const promotions = await this.repository.findAll();
    return promotions
      .filter((promotion) => isLive(promotion, now))
      .filter((promotion) => !placement || promotion.placements.includes(placement))
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((promotion) => toCard(promotion, locale));
  }

  /** A live promotion by slug, or null when missing, inactive or out of schedule. */
  async findPublic(slug: string, locale: Locale): Promise<PromotionDetail | null> {
    const promotion = await this.repository.findBySlug(slug);
    if (!promotion || !isLive(promotion, Date.now())) return null;
    return toDetail(promotion, locale);
  }
}
