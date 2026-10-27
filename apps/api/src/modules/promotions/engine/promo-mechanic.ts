import type { ActivityEvent, PromoBlockOf, PromoBlockType, Promotion } from '@metrobet/contracts';

export type MechanicActivity<T extends PromoBlockType> = {
  promotion: Promotion;
  block: PromoBlockOf<T>;
  event: ActivityEvent;
};

/**
 * A promo mechanic plugin: the server side of an interactive block type (wheel, later wager
 * missions, leaderboards…). The engine only calls `onActivity` for events that happened while
 * the promotion was live, from players allowed to take part (opted in, when it asks for that).
 * Register the class in `PROMO_MECHANICS` (promotions.module.ts).
 */
export interface PromoMechanic<T extends PromoBlockType = PromoBlockType> {
  readonly blockType: T;
  onActivity(activity: MechanicActivity<T>): Promise<void>;
}

/** Multi-provider token: every registered mechanic. */
export const PROMO_MECHANICS = Symbol('PROMO_MECHANICS');
