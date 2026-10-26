import {
  type PromotionCard,
  type PromotionDetail,
  type PromotionDetailQuery,
  promotionDetailQuerySchema,
  type PromotionListQuery,
  promotionListQuerySchema,
} from '@metrobet/contracts';
import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';

@Controller('promotions')
export class PromotionsController {
  constructor(@Inject(PromotionsService) private readonly promotions: PromotionsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(promotionListQuerySchema)) query: PromotionListQuery,
  ): Promise<PromotionCard[]> {
    return this.promotions.listPublic(query);
  }

  @Get(':slug')
  async detail(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(promotionDetailQuerySchema)) { locale }: PromotionDetailQuery,
  ): Promise<PromotionDetail> {
    const promotion = await this.promotions.findPublic(slug, locale);
    if (!promotion) throw new NotFoundException(`Promotion "${slug}" not found`);
    return promotion;
  }
}
