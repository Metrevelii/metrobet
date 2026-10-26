import { Module } from '@nestjs/common';

import { GameAggregator } from './aggregator/game-aggregator.js';
import { MockAggregatorController } from './aggregator/mock/mock-aggregator.controller.js';
import { MockGameAggregator } from './aggregator/mock/mock-aggregator.js';
import { CasinoSyncService } from './casino-sync.service.js';
import { CasinoCatalog } from './casino.catalog.js';
import { CasinoController } from './casino.controller.js';
import { CasinoService } from './casino.service.js';

@Module({
  controllers: [CasinoController, MockAggregatorController],
  providers: [
    CasinoCatalog,
    CasinoService,
    CasinoSyncService,
    // Swap for the real aggregator adapter once a contract is signed (and drop the mock controller).
    { provide: GameAggregator, useClass: MockGameAggregator },
  ],
  exports: [CasinoSyncService],
})
export class CasinoModule {}
