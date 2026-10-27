import type { Promotion, PromotionInput } from '@metrobet/contracts';

/** Thrown by create/update when another promotion already uses the slug. */
export class PromotionSlugTakenError extends Error {
  constructor(readonly slug: string) {
    super(`Slug "${slug}" is already used by another promotion`);
  }
}

/**
 * Storage port for promotions (bound to the Drizzle adapter). Lists are ordered by sortOrder.
 * Methods that target one promotion return null when it does not exist.
 */
export abstract class PromotionsRepository {
  abstract findAll(): Promise<Promotion[]>;
  abstract findById(id: string): Promise<Promotion | null>;
  abstract findBySlug(slug: string): Promise<Promotion | null>;
  /** Appends to the end of the display order. */
  abstract create(input: PromotionInput): Promise<Promotion>;
  abstract update(id: string, input: PromotionInput): Promise<Promotion | null>;
  abstract setActive(id: string, isActive: boolean): Promise<Promotion | null>;
  /** `ids` must contain every promotion exactly once, in the new order. */
  abstract reorder(ids: string[]): Promise<void>;
  abstract delete(id: string): Promise<Promotion | null>;
  /** When the player opted in to the promotion, or null if they have not. */
  abstract findEnrollment(promotionId: string, playerId: string): Promise<Date | null>;
  /** Idempotent: enrolling again keeps the original date. Returns the enrollment date. */
  abstract enroll(promotionId: string, playerId: string): Promise<Date>;
}
