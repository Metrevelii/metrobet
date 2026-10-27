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

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentStaff,
  Roles,
  StaffAuthGuard,
  type StaffPrincipal,
  staffActor,
} from '../auth/auth.guards.js';
import { AdminPromotionsService } from './admin-promotions.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('admin/promotions')
@UseGuards(StaffAuthGuard)
@Roles('marketing')
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
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodValidationPipe(promotionInputSchema)) input: PromotionInput,
  ): Promise<Promotion> {
    return this.promotions.create(staffActor(staff), input);
  }

  /** Declared before `:id` routes so "order" is not parsed as an id. */
  @Put('order')
  reorder(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodValidationPipe(promotionReorderInputSchema)) { ids }: PromotionReorderInput,
  ): Promise<Promotion[]> {
    return this.promotions.reorder(staffActor(staff), ids);
  }

  @Put(':id')
  update(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(promotionInputSchema)) input: PromotionInput,
  ): Promise<Promotion> {
    return this.promotions.update(staffActor(staff), id, input);
  }

  @Patch(':id/active')
  setActive(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(promotionActiveInputSchema)) { isActive }: PromotionActiveInput,
  ): Promise<Promotion> {
    return this.promotions.setActive(staffActor(staff), id, isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentStaff() staff: StaffPrincipal, @Param('id', uuid) id: string): Promise<void> {
    return this.promotions.delete(staffActor(staff), id);
  }
}
