import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { GameAggregator } from './aggregator/game-aggregator.js';
import { MockAggregatorController } from './aggregator/mock/mock-aggregator.controller.js';
import { MockGameAggregator } from './aggregator/mock/mock-aggregator.js';
import { PublicDemoAggregator } from './aggregator/public-demos/public-demo-aggregator.js';
import { CasinoSyncService } from './casino-sync.service.js';
import { CasinoCatalog } from './casino.catalog.js';
import { CasinoController } from './casino.controller.js';
import { CasinoService } from './casino.service.js';
import { WebModule } from '../web/web.module.js';

@Module({
  imports: [WebModule],
  controllers: [CasinoController, MockAggregatorController],
  providers: [
    CasinoCatalog,
    CasinoService,
    CasinoSyncService,
    MockGameAggregator,
    PublicDemoAggregator,
    // CASINO_AGGREGATOR picks the adapter. Add the contracted aggregator here when signed.
    {
      provide: GameAggregator,
      inject: [ConfigService, MockGameAggregator, PublicDemoAggregator],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockGameAggregator,
        demos: PublicDemoAggregator,
      ) => (config.get('CASINO_AGGREGATOR', { infer: true }) === 'public-demos' ? demos : mock),
    },
  ],
  exports: [CasinoService, CasinoSyncService],
})
export class CasinoModule {}
