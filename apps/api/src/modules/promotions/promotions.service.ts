import {
  type Locale,
  type Promotion,
  type PromotionCard,
  type PromotionDetail,
  type PromotionEnrollment,
  type PromotionListQuery,
  requiresOptIn,
} from '@metrobet/contracts';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

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

  /** The player's opt-in state. 404 unless the promotion is live. */
  async getEnrollment(slug: string, playerId: string): Promise<PromotionEnrollment> {
    const promotion = await this.getLive(slug);
    return toEnrollment(await this.repository.findEnrollment(promotion.id, playerId));
  }

  /** Opts the player in (idempotent). 400 when the promotion has no opt-in. */
  async enroll(slug: string, playerId: string): Promise<PromotionEnrollment> {
    const promotion = await this.getLive(slug);
    if (!requiresOptIn(promotion.blocks)) {
      throw new BadRequestException('This promotion does not need opt-in');
    }
    return toEnrollment(await this.repository.enroll(promotion.id, playerId));
  }

  /** A live promotion by slug, or 404. */
  async getLive(slug: string): Promise<Promotion> {
    const promotion = await this.repository.findBySlug(slug);
    if (!promotion || !isLive(promotion, Date.now())) {
      throw new NotFoundException(`Promotion "${slug}" not found`);
    }
    return promotion;
  }
}

const toEnrollment = (enrolledAt: Date | null): PromotionEnrollment => ({
  enrolled: enrolledAt !== null,
  enrolledAt: enrolledAt?.toISOString() ?? null,
});
