import { type Promotion, promotionSchema } from '@metrobet/contracts';
import { Injectable } from '@nestjs/common';

import { PromotionsRepository } from './promotions.repository.js';
import { PROMOTIONS_SEED } from './promotions.seed.js';

@Injectable()
export class InMemoryPromotionsRepository extends PromotionsRepository {
  private readonly promotions: Promotion[] = promotionSchema.array().parse(PROMOTIONS_SEED);

  findAll() {
    return Promise.resolve(this.promotions);
  }

  findBySlug(slug: string) {
    return Promise.resolve(this.promotions.find((promotion) => promotion.slug === slug) ?? null);
  }
}
