import type { Dashboard } from '@metrobet/contracts';
import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { DashboardService } from './dashboard.service.js';

@Controller('admin/dashboard')
@UseGuards(StaffAuthGuard)
@Roles('risk', 'finance', 'support', 'marketing')
export class AdminDashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  /** Today in Tbilisi: stakes, wins and GGR per product, players, open tickets, balances. */
  @Get()
  today(): Promise<Dashboard> {
    return this.dashboard.today();
  }
}
