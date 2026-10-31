import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminPlayersController } from './admin-players.controller.js';
import { AdminPlayersService } from './admin-players.service.js';
import { PlayersAuthController } from './players-auth.controller.js';
import { PlayersService } from './players.service.js';

@Module({
  imports: [AuditModule, WalletModule],
  controllers: [PlayersAuthController, AdminPlayersController],
  providers: [PlayersService, AdminPlayersService],
  exports: [PlayersService, AdminPlayersService],
})
export class PlayersModule {}
