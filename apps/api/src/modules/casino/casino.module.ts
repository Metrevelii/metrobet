import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { OriginalsAggregator } from '../originals/originals.aggregator.js';
import { OriginalsModule } from '../originals/originals.module.js';
import { CombinedAggregator } from './aggregator/combined-aggregator.js';
import { GameAggregator } from './aggregator/game-aggregator.js';
import { MockAggregatorController } from './aggregator/mock/mock-aggregator.controller.js';
import { MockGameAggregator } from './aggregator/mock/mock-aggregator.js';
import { MockGameServer } from './aggregator/mock/mock-game-server.js';
import { GameWalletClient } from '../../common/game-wallet/game-wallet-client.js';
import { PublicDemoAggregator } from './aggregator/public-demos/public-demo-aggregator.js';
import { CasinoSyncService } from './casino-sync.service.js';
import { CasinoCatalog } from './casino.catalog.js';
import { CasinoController } from './casino.controller.js';
import { CasinoService } from './casino.service.js';
import { PlayersModule } from '../players/players.module.js';
import { WebModule } from '../web/web.module.js';
import { GameSessions } from './game-sessions.js';

@Module({
  imports: [OriginalsModule, PlayersModule, WebModule],
  controllers: [CasinoController, MockAggregatorController],
  providers: [
    CasinoCatalog,
    CasinoService,
    CasinoSyncService,
    GameSessions,
    MockGameAggregator,
    MockGameServer,
    GameWalletClient,
    PublicDemoAggregator,
    // CASINO_AGGREGATOR picks the adapter (add the contracted aggregator here when signed);
    // Metrobet Originals are always merged in.
    {
      provide: GameAggregator,
      inject: [ConfigService, MockGameAggregator, PublicDemoAggregator, OriginalsAggregator],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockGameAggregator,
        demos: PublicDemoAggregator,
        originals: OriginalsAggregator,
      ) =>
        new CombinedAggregator(
          config.get('CASINO_AGGREGATOR', { infer: true }) === 'public-demos' ? demos : mock,
          [originals],
        ),
    },
  ],
  exports: [CasinoService, CasinoSyncService, GameSessions],
})
export class CasinoModule {}
