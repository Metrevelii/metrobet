import {
  type PlaceBetsResponse,
  placeBetsRequestSchema,
  type TicketsPage,
  ticketsQuerySchema,
} from '@metrobet/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { BettingService } from './betting.service.js';

@Controller('sportsbook/bets')
@UseGuards(PlayerAuthGuard)
export class BettingController {
  constructor(@Inject(BettingService) private readonly betting: BettingService) {}

  @Post()
  @HttpCode(200)
  place(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(placeBetsRequestSchema))
    request: z.output<typeof placeBetsRequestSchema>,
  ): Promise<PlaceBetsResponse> {
    return this.betting.place(playerId, request);
  }

  @Get()
  list(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query(new ZodValidationPipe(ticketsQuerySchema)) query: z.output<typeof ticketsQuerySchema>,
  ): Promise<TicketsPage> {
    return this.betting.list(playerId, query);
  }
}
