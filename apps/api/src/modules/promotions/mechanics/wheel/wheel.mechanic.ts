import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../../../database/database.tokens.js';
import type { MechanicActivity, PromoMechanic } from '../../engine/promo-mechanic.js';
import { promoWheelProgress } from './wheel.schema.js';

/** Wheel: bets on the configured game types add to the player's wagered total. */
@Injectable()
export class WheelMechanic implements PromoMechanic<'wheel'> {
  readonly blockType = 'wheel';

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async onActivity({ promotion, block, event }: MechanicActivity<'wheel'>): Promise<void> {
    if (event.kind !== 'casino.bet' || !block.earn.gameTypes.includes(event.gameType)) return;
    await this.db
      .insert(promoWheelProgress)
      .values({
        promotionId: promotion.id,
        blockId: block.id,
        playerId: event.playerId,
        wagered: event.amount,
      })
      .onConflictDoUpdate({
        target: [
          promoWheelProgress.promotionId,
          promoWheelProgress.blockId,
          promoWheelProgress.playerId,
        ],
        set: { wagered: sql`${promoWheelProgress.wagered} + ${event.amount}` },
      });
  }
}
