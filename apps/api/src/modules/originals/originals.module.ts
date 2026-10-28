import { Module } from '@nestjs/common';

import { GameWalletClient } from '../../common/game-wallet/game-wallet-client.js';
import { CrashService } from './crash/crash.service.js';
import { OriginalsController } from './originals.controller.js';
import { OriginalsAggregator } from './originals.aggregator.js';
import { OriginalsGateway } from './originals.gateway.js';
import { SupraFortuneService } from './supra-fortune/supra-fortune.service.js';
import { DemoWallet } from './wallet/demo-wallet.js';
import { OriginalsWallet } from './wallet/originals-wallet.js';

/**
 * Metrobet Originals: the in-house studio's game server. Depends on nothing but the database and
 * the game wallet API (over HTTP), like an external studio would.
 */
@Module({
  controllers: [OriginalsController],
  providers: [
    GameWalletClient,
    DemoWallet,
    OriginalsWallet,
    OriginalsAggregator,
    SupraFortuneService,
    CrashService,
    OriginalsGateway,
  ],
  exports: [OriginalsAggregator],
})
export class OriginalsModule {}
