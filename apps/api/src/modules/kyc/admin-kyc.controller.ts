import {
  type AdminKycCheck,
  type AdminKycChecksPage,
  adminKycQuerySchema,
  type KycDecision,
  kycDecisionSchema,
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
import { KycService } from './kyc.service.js';

/** Identity checks for staff; support and risk decide checks in review. */
@Controller('admin/kyc')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminKycController {
  constructor(@Inject(KycService) private readonly kyc: KycService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminKycQuerySchema)) query: z.output<typeof adminKycQuerySchema>,
  ): Promise<AdminKycChecksPage> {
    return this.kyc.adminList(query);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @Roles('support', 'risk')
  decide(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(kycDecisionSchema)) decision: KycDecision,
  ): Promise<AdminKycCheck> {
    return this.kyc.decide(staffActor(staff), id, decision);
  }
}
