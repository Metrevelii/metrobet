import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { GameAggregator } from './aggregator/game-aggregator.js';
import { MockAggregatorController } from './aggregator/mock/mock-aggregator.controller.js';
import { MockGameAggregator } from './aggregator/mock/mock-aggregator.js';
import { PragmaticDemoAggregator } from './aggregator/pragmatic-demo/pragmatic-demo-aggregator.js';
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
    PragmaticDemoAggregator,
    // CASINO_AGGREGATOR picks the adapter. Add the contracted aggregator here when signed.
    {
      provide: GameAggregator,
      inject: [ConfigService, MockGameAggregator, PragmaticDemoAggregator],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockGameAggregator,
        pragmatic: PragmaticDemoAggregator,
      ) =>
        config.get('CASINO_AGGREGATOR', { infer: true }) === 'pragmatic-demo' ? pragmatic : mock,
    },
  ],
  exports: [CasinoSyncService],
})
export class CasinoModule {}
