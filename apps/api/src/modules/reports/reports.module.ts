import { Module } from '@nestjs/common';

import { BettingModule } from '../betting/betting.module.js';
import { PlayersModule } from '../players/players.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/** Backoffice reporting composed from other modules' services (owns no tables). */
@Module({
  imports: [BettingModule, PlayersModule, WalletModule],
  controllers: [AdminDashboardController],
  providers: [DashboardService],
})
export class ReportsModule {}
