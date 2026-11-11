import {
  type ExclusionInput,
  exclusionInputSchema,
  type PlayActivity,
  playActivityQuerySchema,
  type RealityCheckInput,
  realityCheckInputSchema,
  type RealityCheckSettings,
  type ResponsibleGaming,
  type SetLimitInput,
  setLimitInputSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { ResponsibleGamingService } from './responsible-gaming.service.js';

/** The player's own responsible-gaming tools. */
@Controller('responsible-gaming')
@UseGuards(PlayerAuthGuard)
export class ResponsibleGamingController {
  constructor(@Inject(ResponsibleGamingService) private readonly rg: ResponsibleGamingService) {}

  @Get()
  overview(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<ResponsibleGaming> {
    return this.rg.overview(playerId);
  }

  @Put('limits')
  setLimit(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(setLimitInputSchema)) input: SetLimitInput,
  ): Promise<ResponsibleGaming> {
    return this.rg.setLimit(playerId, input);
  }

  @Get('reality-check')
  realityCheck(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<RealityCheckSettings> {
    return this.rg.realityCheck(playerId);
  }

  @Put('reality-check')
  setRealityCheck(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(realityCheckInputSchema)) { minutes }: RealityCheckInput,
  ): Promise<RealityCheckSettings> {
    return this.rg.setRealityCheck(playerId, minutes);
  }

  @Get('activity')
  activity(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query(new ZodValidationPipe(playActivityQuerySchema))
    { since }: z.output<typeof playActivityQuerySchema>,
  ): Promise<PlayActivity> {
    return this.rg.activity(playerId, new Date(since));
  }

  /** Signs the player out everywhere. Rate limited: it checks the password. */
  @Post('exclusion')
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  exclude(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(exclusionInputSchema)) input: ExclusionInput,
  ): Promise<void> {
    return this.rg.exclude(playerId, input);
  }
}
