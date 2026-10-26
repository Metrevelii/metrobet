import type { Promotion, PromotionInput } from '@metrobet/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { WebRevalidationService } from '../web/web-revalidation.service.js';
import { PromotionSlugTakenError, PromotionsRepository } from './promotions.repository.js';

/** Must match PROMOTIONS_CACHE_TAG in apps/web/src/features/promotions/data.ts. */
export const PROMOTIONS_CACHE_TAG = 'promotions';
const ENTITY = 'promotion';

/** Backoffice operations: every mutation is audited and refreshes the player site's cache. */
@Injectable()
export class AdminPromotionsService {
  constructor(
    @Inject(PromotionsRepository) private readonly repository: PromotionsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WebRevalidationService) private readonly web: WebRevalidationService,
  ) {}

  list(): Promise<Promotion[]> {
    return this.repository.findAll();
  }

  async get(id: string): Promise<Promotion> {
    return this.orNotFound(id, await this.repository.findById(id));
  }

  async create(actor: string, input: PromotionInput): Promise<Promotion> {
    const created = await this.withSlugConflict(() => this.repository.create(input));
    await this.changed(actor, 'create', created.id, null, created);
    return created;
  }

  async update(actor: string, id: string, input: PromotionInput): Promise<Promotion> {
    const before = await this.get(id);
    const after = this.orNotFound(
      id,
      await this.withSlugConflict(() => this.repository.update(id, input)),
    );
    await this.changed(actor, 'update', id, before, after);
    return after;
  }

  async setActive(actor: string, id: string, isActive: boolean): Promise<Promotion> {
    const before = await this.get(id);
    const after = this.orNotFound(id, await this.repository.setActive(id, isActive));
    await this.changed(actor, isActive ? 'activate' : 'deactivate', id, before, after);
    return after;
  }

  async reorder(actor: string, ids: string[]): Promise<Promotion[]> {
    const current = await this.repository.findAll();
    const known = new Set(current.map((promotion) => promotion.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => known.has(id))
    ) {
      throw new BadRequestException('ids must list every promotion exactly once');
    }
    await this.repository.reorder(ids);
    const before = current.map((promotion) => promotion.id);
    await this.changed(actor, 'reorder', '*', { order: before }, { order: ids });
    return this.repository.findAll();
  }

  async delete(actor: string, id: string): Promise<void> {
    const deleted = this.orNotFound(id, await this.repository.delete(id));
    await this.changed(actor, 'delete', id, deleted, null);
  }

  private async changed(
    actor: string,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    await this.audit.record({
      actor,
      action: `${ENTITY}.${action}`,
      entityType: ENTITY,
      entityId,
      before,
      after,
    });
    await this.web.revalidate(PROMOTIONS_CACHE_TAG);
  }

  private orNotFound<T>(id: string, value: T | null): T {
    if (value === null) throw new NotFoundException(`Promotion ${id} not found`);
    return value;
  }

  private async withSlugConflict<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof PromotionSlugTakenError) throw new ConflictException(error.message);
      throw error;
    }
  }
}
