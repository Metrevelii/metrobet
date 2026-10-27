import type { WheelSpinResult, WheelState } from '@metrobet/contracts';
import { Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../../../auth/auth.guards.js';
import { WheelService } from './wheel.service.js';

@Controller('promotions/:slug/wheels/:blockId')
@UseGuards(PlayerAuthGuard)
export class WheelController {
  constructor(@Inject(WheelService) private readonly wheels: WheelService) {}

  @Get()
  state(
    @Param('slug') slug: string,
    @Param('blockId') blockId: string,
    @CurrentPlayer() { playerId }: PlayerPrincipal,
  ): Promise<WheelState> {
    return this.wheels.getState(slug, blockId, playerId);
  }

  @Post('spin')
  @HttpCode(200)
  spin(
    @Param('slug') slug: string,
    @Param('blockId') blockId: string,
    @CurrentPlayer() { playerId }: PlayerPrincipal,
  ): Promise<WheelSpinResult> {
    return this.wheels.spin(slug, blockId, playerId);
  }
}
