import {
  type PromotionCard,
  type PromotionEnrollment,
  type PromotionDetail,
  type PromotionDetailQuery,
  promotionDetailQuerySchema,
  type PromotionListQuery,
  promotionListQuerySchema,
} from '@metrobet/contracts';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
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

  @Get(':slug/enrollment')
  @UseGuards(PlayerAuthGuard)
  enrollment(
    @Param('slug') slug: string,
    @CurrentPlayer() { playerId }: PlayerPrincipal,
  ): Promise<PromotionEnrollment> {
    return this.promotions.getEnrollment(slug, playerId);
  }

  /** Opt in. Idempotent, so it answers 200 rather than 201. */
  @Post(':slug/enrollment')
  @HttpCode(200)
  @UseGuards(PlayerAuthGuard)
  enroll(
    @Param('slug') slug: string,
    @CurrentPlayer() { playerId }: PlayerPrincipal,
  ): Promise<PromotionEnrollment> {
    return this.promotions.enroll(slug, playerId);
  }
}
