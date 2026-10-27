import { Module } from '@nestjs/common';

import { PlayersAuthController } from './players-auth.controller.js';
import { PlayersService } from './players.service.js';

@Module({
  controllers: [PlayersAuthController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
