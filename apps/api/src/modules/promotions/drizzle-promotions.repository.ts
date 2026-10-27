import type { Promotion, PromotionInput } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, max } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { isUniqueViolation } from '../../database/errors.js';
import { PromotionSlugTakenError, PromotionsRepository } from './promotions.repository.js';
import {
  type NewPromotionRow,
  type PromotionRow,
  promotionEnrollments,
  promotions,
} from './promotions.schema.js';

const SORT_STEP = 10;

function toPromotion({
  imageDesktop,
  imageMobile,
  startsAt,
  endsAt,
  ...row
}: PromotionRow): Promotion {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    image: { desktop: imageDesktop, mobile: imageMobile },
    blocks: row.blocks,
    placements: row.placements,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
  };
}

function toRow({ image, startsAt, endsAt, ...input }: PromotionInput) {
  return {
    ...input,
    imageDesktop: image.desktop,
    imageMobile: image.mobile,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  } satisfies Omit<NewPromotionRow, 'sortOrder'>;
}

@Injectable()
export class DrizzlePromotionsRepository extends PromotionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super();
  }

  async findAll() {
    const rows = await this.db.select().from(promotions).orderBy(asc(promotions.sortOrder));
    return rows.map(toPromotion);
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(promotions).where(eq(promotions.id, id));
    return row ? toPromotion(row) : null;
  }

  async findBySlug(slug: string) {
    const [row] = await this.db.select().from(promotions).where(eq(promotions.slug, slug));
    return row ? toPromotion(row) : null;
  }

  async create(input: PromotionInput) {
    return this.translateErrors(input.slug, async () => {
      const [{ last } = { last: null }] = await this.db
        .select({ last: max(promotions.sortOrder) })
        .from(promotions);
      const [row] = await this.db
        .insert(promotions)
        .values({ ...toRow(input), sortOrder: (last ?? 0) + SORT_STEP })
        .returning();
      return toPromotion(row!);
    });
  }

  async update(id: string, input: PromotionInput) {
    return this.translateErrors(input.slug, async () => {
      const [row] = await this.db
        .update(promotions)
        .set(toRow(input))
        .where(eq(promotions.id, id))
        .returning();
      return row ? toPromotion(row) : null;
    });
  }

  async setActive(id: string, isActive: boolean) {
    const [row] = await this.db
      .update(promotions)
      .set({ isActive })
      .where(eq(promotions.id, id))
      .returning();
    return row ? toPromotion(row) : null;
  }

  async reorder(ids: string[]) {
    await this.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(promotions)
          .set({ sortOrder: (index + 1) * SORT_STEP })
          .where(eq(promotions.id, id));
      }
    });
  }

  async delete(id: string) {
    const [row] = await this.db.delete(promotions).where(eq(promotions.id, id)).returning();
    return row ? toPromotion(row) : null;
  }

  async findEnrollment(promotionId: string, playerId: string) {
    const [row] = await this.db
      .select({ enrolledAt: promotionEnrollments.enrolledAt })
      .from(promotionEnrollments)
      .where(
        and(
          eq(promotionEnrollments.promotionId, promotionId),
          eq(promotionEnrollments.playerId, playerId),
        ),
      );
    return row?.enrolledAt ?? null;
  }

  async enroll(promotionId: string, playerId: string) {
    await this.db
      .insert(promotionEnrollments)
      .values({ promotionId, playerId })
      .onConflictDoNothing();
    return (await this.findEnrollment(promotionId, playerId))!;
  }

  private async translateErrors<T>(slug: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error, 'promotions_slug_unique'))
        throw new PromotionSlugTakenError(slug);
      throw error;
    }
  }
}
