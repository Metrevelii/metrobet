import {
  type Promotion,
  type PromotionActiveInput,
  promotionActiveInputSchema,
  type PromotionInput,
  promotionInputSchema,
  type PromotionReorderInput,
  promotionReorderInputSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { ADMIN_KEY_ACTOR, AdminKeyGuard } from '../../common/guards/admin-key.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminPromotionsService } from './admin-promotions.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('admin/promotions')
@UseGuards(AdminKeyGuard)
export class AdminPromotionsController {
  constructor(
    @Inject(AdminPromotionsService) private readonly promotions: AdminPromotionsService,
  ) {}

  /** Every promotion (any status), in display order. */
  @Get()
  list(): Promise<Promotion[]> {
    return this.promotions.list();
  }

  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<Promotion> {
    return this.promotions.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(promotionInputSchema)) input: PromotionInput,
  ): Promise<Promotion> {
    return this.promotions.create(ADMIN_KEY_ACTOR, input);
  }

  /** Declared before `:id` routes so "order" is not parsed as an id. */
  @Put('order')
  reorder(
    @Body(new ZodValidationPipe(promotionReorderInputSchema)) { ids }: PromotionReorderInput,
  ): Promise<Promotion[]> {
    return this.promotions.reorder(ADMIN_KEY_ACTOR, ids);
  }

  @Put(':id')
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(promotionInputSchema)) input: PromotionInput,
  ): Promise<Promotion> {
    return this.promotions.update(ADMIN_KEY_ACTOR, id, input);
  }

  @Patch(':id/active')
  setActive(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(promotionActiveInputSchema)) { isActive }: PromotionActiveInput,
  ): Promise<Promotion> {
    return this.promotions.setActive(ADMIN_KEY_ACTOR, id, isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', uuid) id: string): Promise<void> {
    return this.promotions.delete(ADMIN_KEY_ACTOR, id);
  }
}
