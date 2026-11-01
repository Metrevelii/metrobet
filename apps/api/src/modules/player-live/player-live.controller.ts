import type { PlayerSocketPass } from '@metrobet/contracts';
import { Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';

import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { PlayerSocketPasses } from './player-socket-passes.js';

@Controller('player-live')
@UseGuards(PlayerAuthGuard)
export class PlayerLiveController {
  constructor(@Inject(PlayerSocketPasses) private readonly passes: PlayerSocketPasses) {}

  /** A one-time pass (60 s) to open the player's live channel. */
  @Post('pass')
  @HttpCode(200)
  pass(@CurrentPlayer() { playerId }: PlayerPrincipal): PlayerSocketPass {
    return { pass: this.passes.issue(playerId) };
  }
}
