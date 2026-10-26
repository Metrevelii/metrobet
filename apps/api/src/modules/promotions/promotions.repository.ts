import type { Promotion } from '@metrobet/contracts';

/**
 * Storage port for promotions. The in-memory adapter is used until the database lands;
 * a Drizzle adapter will replace it without touching the service or controller.
 */
export abstract class PromotionsRepository {
  abstract findAll(): Promise<Promotion[]>;
  abstract findBySlug(slug: string): Promise<Promotion | null>;
}
