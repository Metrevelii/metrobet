import { type Promotion, requiresOptIn } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { PromotionsRepository } from '../promotions.repository.js';

/** Who may take part: everyone, or only players who opted in (before `at`, when given). */
@Injectable()
export class PromoEligibility {
  constructor(@Inject(PromotionsRepository) private readonly repository: PromotionsRepository) {}

  async isEligible(promotion: Promotion, playerId: string, at = Date.now()): Promise<boolean> {
    if (!requiresOptIn(promotion.blocks)) return true;
    const enrolledAt = await this.repository.findEnrollment(promotion.id, playerId);
    return enrolledAt !== null && enrolledAt.getTime() <= at;
  }
}
