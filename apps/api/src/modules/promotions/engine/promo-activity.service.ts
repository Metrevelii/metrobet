import type { ActivityEvent, PromoBlock, Promotion } from '@metrobet/contracts';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { ActivityBus } from '../../activity/activity-bus.js';
import { isLive } from '../promotions.mapper.js';
import { PromotionsRepository } from '../promotions.repository.js';
import { PromoEligibility } from './promo-eligibility.js';
import { PROMO_MECHANICS, type PromoMechanic } from './promo-mechanic.js';

/**
 * Routes player activity to promo mechanics: for every promotion live at the event's time
 * whose page has a block with a registered mechanic, and that the player may take part in.
 */
@Injectable()
export class PromoActivityService implements OnModuleInit {
  private readonly mechanics: Map<string, PromoMechanic>;

  constructor(
    @Inject(ActivityBus) private readonly bus: ActivityBus,
    @Inject(PromotionsRepository) private readonly repository: PromotionsRepository,
    @Inject(PromoEligibility) private readonly eligibility: PromoEligibility,
    @Inject(PROMO_MECHANICS) mechanics: PromoMechanic[],
  ) {
    this.mechanics = new Map(mechanics.map((mechanic) => [mechanic.blockType, mechanic]));
  }

  onModuleInit() {
    this.bus.subscribe((event) => this.handle(event));
  }

  async handle(event: ActivityEvent): Promise<void> {
    const at = Date.parse(event.occurredAt);
    const promotions = (await this.repository.findAll()).filter(
      (promotion) => isLive(promotion, at) && this.mechanicBlocks(promotion).length > 0,
    );
    for (const promotion of promotions) {
      if (!(await this.eligibility.isEligible(promotion, event.playerId, at))) continue;
      for (const block of this.mechanicBlocks(promotion)) {
        await this.mechanics.get(block.type)!.onActivity({ promotion, block, event });
      }
    }
  }

  private mechanicBlocks(promotion: Promotion): PromoBlock[] {
    return promotion.blocks.filter((block) => this.mechanics.has(block.type));
  }
}
