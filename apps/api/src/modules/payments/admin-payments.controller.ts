import {
  type AdminPayment,
  type AdminPaymentsPage,
  adminPaymentsQuerySchema,
  type WithdrawalDecision,
  withdrawalDecisionSchema,
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
import { PaymentsService } from './payments.service.js';

/** Deposits and withdrawals for staff; finance decides withdrawals. */
@Controller('admin/payments')
@UseGuards(StaffAuthGuard)
@Roles('finance', 'support', 'risk')
export class AdminPaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminPaymentsQuerySchema))
    query: z.output<typeof adminPaymentsQuerySchema>,
  ): Promise<AdminPaymentsPage> {
    return this.payments.adminList(query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('finance')
  approve(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdminPayment> {
    return this.payments.approve(staffActor(staff), id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('finance')
  reject(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(withdrawalDecisionSchema)) { reason }: WithdrawalDecision,
  ): Promise<AdminPayment> {
    return this.payments.reject(staffActor(staff), id, reason);
  }
}
