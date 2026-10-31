import {
  type AdminTicket,
  type AdminTicketsPage,
  adminTicketsQuerySchema,
  type SelectionSettleInput,
  selectionSettleInputSchema,
  type TicketVoidInput,
  ticketVoidInputSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentStaff,
  Roles,
  StaffAuthGuard,
  type StaffPrincipal,
  staffActor,
} from '../auth/auth.guards.js';
import { AdminBetsService } from './admin-bets.service.js';

@Controller('admin/bets')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminBetsController {
  constructor(@Inject(AdminBetsService) private readonly bets: AdminBetsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminTicketsQuerySchema))
    query: z.output<typeof adminTicketsQuerySchema>,
  ): Promise<AdminTicketsPage> {
    return this.bets.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminTicket> {
    return this.bets.get(id);
  }

  /** Void an open ticket (stake refunded). Risk only. */
  @Post(':id/void')
  @HttpCode(200)
  @Roles('risk')
  void(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ticketVoidInputSchema)) input: TicketVoidInput,
  ): Promise<AdminTicket> {
    return this.bets.void(staffActor(staff), id, input);
  }

  /** Settle an unresolved selection by hand. Risk only. */
  @Post(':id/selections/:selectionId/settle')
  @HttpCode(200)
  @Roles('risk')
  settleSelection(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('selectionId') selectionId: string,
    @Body(new ZodValidationPipe(selectionSettleInputSchema)) input: SelectionSettleInput,
  ): Promise<AdminTicket> {
    return this.bets.settleSelection(staffActor(staff), id, selectionId, input);
  }
}
