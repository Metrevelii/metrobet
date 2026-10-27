import { type DevCasinoBetInput, devCasinoBetInputSchema } from '@metrobet/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { CasinoService } from '../casino/casino.service.js';
import { ActivityBus } from './activity-bus.js';

/**
 * Development only (404 in production): simulates a casino bet for the signed-in player until
 * the aggregator's wallet callbacks publish real ones. Lets the promo mechanics be tried today.
 */
@Controller('dev/activity')
export class DevActivityController {
  constructor(
    @Inject(ActivityBus) private readonly bus: ActivityBus,
    @Inject(CasinoService) private readonly casino: CasinoService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('casino-bet')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  async casinoBet(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(devCasinoBetInputSchema)) { gameSlug, amount }: DevCasinoBetInput,
  ): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new NotFoundException();
    }
    const game = await this.casino.getGame(gameSlug);
    await this.bus.publish({
      id: `dev:${randomUUID()}`,
      kind: 'casino.bet',
      playerId,
      occurredAt: new Date().toISOString(),
      amount,
      currency: 'GEL',
      gameSlug: game.slug,
      gameType: game.type,
    });
  }
}
