import {
  type EventLiability,
  type EventLiabilitySummary,
  liabilityQuerySchema,
} from '@metrobet/contracts';
import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { LiabilityService } from './liability.service.js';

/** What open tickets risk per event (backoffice trading). */
@Controller('admin/sportsbook/liability')
@UseGuards(StaffAuthGuard)
@Roles('risk')
export class AdminLiabilityController {
  constructor(@Inject(LiabilityService) private readonly liability: LiabilityService) {}

  @Get()
  summaries(
    @Query(new ZodValidationPipe(liabilityQuerySchema))
    { eventIds }: z.output<typeof liabilityQuerySchema>,
  ): Promise<EventLiabilitySummary[]> {
    return this.liability.summaries(eventIds);
  }

  @Get(':eventId')
  event(@Param('eventId') eventId: string): Promise<EventLiability> {
    return this.liability.event(eventId);
  }
}
