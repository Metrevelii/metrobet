import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PlayersModule } from '../players/players.module.js';
import { SportsbookModule } from '../sportsbook/sportsbook.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminBetsController } from './admin-bets.controller.js';
import { AdminBetsService } from './admin-bets.service.js';
import { BettingController } from './betting.controller.js';
import { BettingService } from './betting.service.js';
import { SettlementService } from './settlement.service.js';

/** Sportsbook tickets: placement, settlement, history. See CLAUDE.md. */
@Module({
  imports: [ActivityModule, AuditModule, PlayersModule, SportsbookModule, WalletModule],
  controllers: [BettingController, AdminBetsController],
  providers: [BettingService, SettlementService, AdminBetsService],
  exports: [AdminBetsService],
})
export class BettingModule {}
