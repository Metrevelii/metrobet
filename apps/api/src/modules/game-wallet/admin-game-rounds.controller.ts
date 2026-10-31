import { type AdminGameRoundsPage, adminListQuerySchema } from '@metrobet/contracts';
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { GameRoundsService } from './game-rounds.service.js';

/** Staff view of a player's casino and crash rounds (provider rounds settled via the game wallet). */
@Controller('admin/players/:playerId/rounds')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminGameRoundsController {
  constructor(@Inject(GameRoundsService) private readonly rounds: GameRoundsService) {}

  @Get()
  list(
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
    @Query(new ZodValidationPipe(adminListQuerySchema))
    { page, pageSize }: z.output<typeof adminListQuerySchema>,
  ): Promise<AdminGameRoundsPage> {
    return this.rounds.listForPlayer(playerId, page, pageSize);
  }
}
