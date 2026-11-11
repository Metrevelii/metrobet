import type { ResponsibleGaming } from '@metrobet/contracts';
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { ResponsibleGamingService } from './responsible-gaming.service.js';

/** A player's limits and reality check as staff see them (read-only: only players set them). */
@Controller('admin/players')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminResponsibleGamingController {
  constructor(@Inject(ResponsibleGamingService) private readonly rg: ResponsibleGamingService) {}

  @Get(':id/responsible-gaming')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResponsibleGaming> {
    return this.rg.overview(id);
  }
}
