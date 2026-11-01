import {
  type AdminTradingEventDetail,
  type AdminTradingEventsPage,
  adminTradingEventsQuerySchema,
  type Suspension,
  type SuspensionInput,
  suspensionInputSchema,
  type TradingRule,
  type TradingRuleInput,
  tradingRuleInputSchema,
  tradingRuleScopeSchema,
  type TradingRuleScope,
  type TradingTargets,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import {
  CurrentStaff,
  Roles,
  StaffAuthGuard,
  type StaffPrincipal,
  staffActor,
} from '../../auth/auth.guards.js';
import { TradingService } from './trading.service.js';

/** Sportsbook trading for the backoffice: events, suspensions, margin and limit rules. */
@Controller('admin/sportsbook')
@UseGuards(StaffAuthGuard)
@Roles('risk')
export class AdminTradingController {
  constructor(@Inject(TradingService) private readonly trading: TradingService) {}

  @Get('events')
  events(
    @Query(new ZodValidationPipe(adminTradingEventsQuerySchema))
    query: z.output<typeof adminTradingEventsQuerySchema>,
  ): AdminTradingEventsPage {
    return this.trading.events(query);
  }

  @Get('events/:id')
  event(@Param('id') id: string): Promise<AdminTradingEventDetail> {
    return this.trading.event(id);
  }

  @Post('suspensions')
  @HttpCode(200)
  suspend(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodValidationPipe(suspensionInputSchema)) input: SuspensionInput,
  ): Promise<Suspension> {
    return this.trading.suspend(staffActor(staff), input);
  }

  @Post('suspensions/resume')
  @HttpCode(204)
  resume(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodValidationPipe(suspensionInputSchema)) input: SuspensionInput,
  ): Promise<void> {
    return this.trading.resume(staffActor(staff), input);
  }

  @Get('rules')
  rules(): TradingRule[] {
    return this.trading.listRules();
  }

  @Put('rules')
  setRule(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodValidationPipe(tradingRuleInputSchema)) input: TradingRuleInput,
  ): Promise<TradingRule> {
    return this.trading.setRule(staffActor(staff), input);
  }

  @Delete('rules/:scope/:key')
  @HttpCode(204)
  deleteRule(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('scope', new ZodValidationPipe(tradingRuleScopeSchema)) scope: TradingRuleScope,
    @Param('key') key: string,
  ): Promise<void> {
    return this.trading.deleteRule(staffActor(staff), scope, key);
  }

  @Get('targets')
  targets(): TradingTargets {
    return this.trading.targets();
  }
}
