import {
  type PromoBlockOf,
  type Promotion,
  WHEEL_WINS_SHOWN,
  type WheelSpinResult,
  type WheelState,
} from '@metrobet/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../../../database/database.tokens.js';
import { PromoEligibility } from '../../engine/promo-eligibility.js';
import { PromotionsService } from '../../promotions.service.js';
import { promoRewards } from '../../rewards.schema.js';
import { pickWeighted, wheelProgress } from './wheel-math.js';
import { promoWheelProgress, promoWheelSpins } from './wheel.schema.js';

type Wheel = { promotion: Promotion; block: PromoBlockOf<'wheel'> };
type Executor = Pick<Database, 'select'>;

/** Player-facing wheel: progress and spinning. The spin outcome is decided here, never client-side. */
@Injectable()
export class WheelService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PromotionsService) private readonly promotions: PromotionsService,
    @Inject(PromoEligibility) private readonly eligibility: PromoEligibility,
  ) {}

  async getState(slug: string, blockId: string, playerId: string): Promise<WheelState> {
    const wheel = await this.find(slug, blockId);
    return this.state(this.db, wheel, playerId);
  }

  /** Uses one spin. 403 before opt-in, 409 when no spin is available. */
  async spin(slug: string, blockId: string, playerId: string): Promise<WheelSpinResult> {
    const wheel = await this.find(slug, blockId);
    const { promotion, block } = wheel;
    if (!(await this.eligibility.isEligible(promotion, playerId))) {
      throw new ForbiddenException('Join the promotion to spin');
    }

    return this.db.transaction(async (tx) => {
      // Row lock: concurrent spins by the same player queue here, so spins can't be overspent.
      const [progress] = await tx
        .select()
        .from(promoWheelProgress)
        .where(this.progressKey(wheel, playerId))
        .for('update');
      const { spinsAvailable } = wheelProgress(
        progress?.wagered ?? 0,
        progress?.spinsUsed ?? 0,
        block.earn.stepAmount,
      );
      if (spinsAvailable === 0) throw new ConflictException('No spins available');

      const segmentIndex = pickWeighted(block.segments.map((segment) => segment.weight));
      const { freeSpins } = block.segments[segmentIndex]!;

      await tx
        .update(promoWheelProgress)
        .set({ spinsUsed: sql`${promoWheelProgress.spinsUsed} + 1` })
        .where(this.progressKey(wheel, playerId));
      const [spin] = await tx
        .insert(promoWheelSpins)
        .values({ promotionId: promotion.id, blockId: block.id, playerId, segmentIndex, freeSpins })
        .returning({ id: promoWheelSpins.id });
      await tx.insert(promoRewards).values({
        playerId,
        promotionId: promotion.id,
        source: 'wheel',
        sourceId: spin!.id,
        kind: 'freeSpins',
        payload: { count: freeSpins, gameSlug: block.freeSpinsGame },
      });

      return { segmentIndex, freeSpins, state: await this.state(tx, wheel, playerId) };
    });
  }

  private async find(slug: string, blockId: string): Promise<Wheel> {
    const promotion = await this.promotions.getLive(slug);
    const block = promotion.blocks.find((item) => item.id === blockId);
    if (block?.type !== 'wheel') throw new NotFoundException('Wheel not found');
    return { promotion, block };
  }

  private progressKey({ promotion, block }: Wheel, playerId: string) {
    return and(
      eq(promoWheelProgress.promotionId, promotion.id),
      eq(promoWheelProgress.blockId, block.id),
      eq(promoWheelProgress.playerId, playerId),
    );
  }

  private async state(db: Executor, wheel: Wheel, playerId: string): Promise<WheelState> {
    const { promotion, block } = wheel;
    const [[progress], wins, eligible] = await Promise.all([
      db.select().from(promoWheelProgress).where(this.progressKey(wheel, playerId)),
      db
        .select({ freeSpins: promoWheelSpins.freeSpins, wonAt: promoWheelSpins.createdAt })
        .from(promoWheelSpins)
        .where(
          and(
            eq(promoWheelSpins.promotionId, promotion.id),
            eq(promoWheelSpins.blockId, block.id),
            eq(promoWheelSpins.playerId, playerId),
          ),
        )
        .orderBy(desc(promoWheelSpins.createdAt))
        .limit(WHEEL_WINS_SHOWN),
      this.eligibility.isEligible(promotion, playerId),
    ]);
    const wagered = progress?.wagered ?? 0;
    const spinsUsed = progress?.spinsUsed ?? 0;
    return {
      eligible,
      wagered,
      spinsUsed,
      ...wheelProgress(wagered, spinsUsed, block.earn.stepAmount),
      wins: wins.map(({ freeSpins, wonAt }) => ({ freeSpins, wonAt: wonAt.toISOString() })),
    };
  }
}
