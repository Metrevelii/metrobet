import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PlayersModule } from '../players/players.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminResponsibleGamingController } from './admin-responsible-gaming.controller.js';
import { ResponsibleGamingController } from './responsible-gaming.controller.js';
import { ResponsibleGamingService } from './responsible-gaming.service.js';

@Module({
  imports: [AuditModule, PlayersModule, WalletModule],
  controllers: [ResponsibleGamingController, AdminResponsibleGamingController],
  providers: [ResponsibleGamingService],
  exports: [ResponsibleGamingService],
})
export class ResponsibleGamingModule {}
