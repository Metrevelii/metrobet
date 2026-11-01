import {
  cashoutRequestSchema,
  type CashoutResponse,
  type PlaceBetsResponse,
  placeBetsRequestSchema,
  type TicketsPage,
  ticketsQuerySchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  /** Sell an open ticket back at the current offer (`{ amount }` = the offer the player saw). */
  @Post(':id/cashout')
  @HttpCode(200)
  cashout(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(cashoutRequestSchema)) { amount }: { amount: number },
  ): Promise<CashoutResponse> {
    return this.betting.cashout(playerId, id, amount);
  }

  @Get()
  list(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query(new ZodValidationPipe(ticketsQuerySchema)) query: z.output<typeof ticketsQuerySchema>,
  ): Promise<TicketsPage> {
    return this.betting.list(playerId, query);
  }
}
