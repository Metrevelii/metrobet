import { Module } from '@nestjs/common';

import { PgListener } from './pg-listener.js';
import { PlayerLiveController } from './player-live.controller.js';
import { PlayerLiveGateway } from './player-live.gateway.js';
import { PlayerSocketPasses } from './player-socket-passes.js';

/** Live push to players (balance, settled tickets) from Postgres notifications. See CLAUDE.md. */
@Module({
  controllers: [PlayerLiveController],
  providers: [PgListener, PlayerSocketPasses, PlayerLiveGateway],
})
export class PlayerLiveModule {}
