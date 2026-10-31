import { type AuditPage, auditQuerySchema } from '@metrobet/contracts';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { AuditService } from './audit.service.js';

/** Who did what in the backoffice (admin and risk). */
@Controller('admin/audit-log')
@UseGuards(StaffAuthGuard)
@Roles('risk')
export class AdminAuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: z.output<typeof auditQuerySchema>,
  ): Promise<AuditPage> {
    return this.audit.list(query);
  }
}
