import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminBonusController, BonusController } from './bonus.controller.js';
import { BonusService } from './bonus.service.js';

/** Bonus money: grants (promotions), wagering, conversion, forfeits, expiry. See CLAUDE.md. */
@Module({
  imports: [ActivityModule, AuditModule, WalletModule],
  controllers: [BonusController, AdminBonusController],
  providers: [BonusService],
  exports: [BonusService],
})
export class BonusModule {}
