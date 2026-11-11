import { Inject, Injectable } from '@nestjs/common';

import { BonusService } from '../../../bonus/bonus.service.js';
import type { MechanicActivity, PromoMechanic } from '../../engine/promo-mechanic.js';

/** Bonus money for a promotion's deposit offer (percent of the deposit, capped). */
export const depositBonusAmount = (deposit: number, percent: number, maxBonus: number) =>
  Math.min(Math.floor((deposit * percent) / 100), maxBonus);

/**
 * Deposit bonus: the player's first deposit of at least `minDeposit`, made while the promotion is
 * live (and after opting in, when the page asks for it), grants bonus money. Once per player per
 * promotion (the grant key), and never while another bonus is active.
 */
@Injectable()
export class DepositBonusMechanic implements PromoMechanic<'depositBonus'> {
  readonly blockType = 'depositBonus';

  constructor(@Inject(BonusService) private readonly bonuses: BonusService) {}

  async onActivity({ promotion, block, event }: MechanicActivity<'depositBonus'>): Promise<void> {
    if (event.kind !== 'payment.deposit' || !event.first || event.amount < block.minDeposit) return;
    await this.bonuses.grant({
      playerId: event.playerId,
      amount: depositBonusAmount(event.amount, block.percent, block.maxBonus),
      wageringMultiplier: block.wageringMultiplier,
      validDays: block.validDays,
      grantKey: `promo:${promotion.id}:${block.id}:${event.playerId}`,
      promotionId: promotion.id,
      title: promotion.title,
    });
  }
}
