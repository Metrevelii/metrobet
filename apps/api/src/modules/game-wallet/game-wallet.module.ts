import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module.js';
import { CasinoModule } from '../casino/casino.module.js';
import { PlayersModule } from '../players/players.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminGameRoundsController } from './admin-game-rounds.controller.js';
import { GameRoundsService } from './game-rounds.service.js';
import { GameWalletSignatureGuard } from './game-wallet-signature.guard.js';
import { GameWalletController } from './game-wallet.controller.js';
import { GameWalletService } from './game-wallet.service.js';

@Module({
  imports: [ActivityModule, CasinoModule, PlayersModule, WalletModule],
  controllers: [GameWalletController, AdminGameRoundsController],
  providers: [GameWalletService, GameWalletSignatureGuard, GameRoundsService],
})
export class GameWalletModule {}
