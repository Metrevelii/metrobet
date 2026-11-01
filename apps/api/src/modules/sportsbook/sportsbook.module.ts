import {
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { AuditModule } from '../audit/audit.module.js';
import { OddsFeed } from './feed/odds-feed.js';
import { SimulatedOddsFeed } from './feed/simulated/simulated-feed.js';
import { SportsbookController } from './sportsbook.controller.js';
import { SportsbookGateway } from './sportsbook.gateway.js';
import { SportsbookStore } from './sportsbook.store.js';
import { AdminTradingController } from './trading/admin-trading.controller.js';
import { TradingRules } from './trading/trading-rules.js';
import { TradingService } from './trading/trading.service.js';

@Module({
  imports: [AuditModule],
  controllers: [SportsbookController, AdminTradingController],
  providers: [
    TradingRules,
    TradingService,
    SportsbookStore,
    SportsbookGateway,
    // Swap for the licensed feed adapter (Betradar, Genius…) once contracted.
    { provide: OddsFeed, useClass: SimulatedOddsFeed },
  ],
  exports: [SportsbookStore, OddsFeed, TradingRules],
})
export class SportsbookModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(OddsFeed) private readonly feed: OddsFeed,
    @Inject(SportsbookStore) private readonly store: SportsbookStore,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('SPORTSBOOK_FEED', { infer: true }) === 'simulated')
      this.feed.start(this.store);
  }

  onApplicationShutdown() {
    this.feed.stop();
  }
}
