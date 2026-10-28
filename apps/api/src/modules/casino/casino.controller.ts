import {
  type CasinoLobby,
  type GameDetail,
  type GameLaunchRequest,
  gameLaunchRequestSchema,
  type GameLaunchResponse,
  type GamePage,
  type GameSessionRequest,
  gameSessionRequestSchema,
  type GameType,
  gameTypeSchema,
  gameListQuerySchema,
  type Provider,
  slugSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { CasinoService } from './casino.service.js';

const slug = new ZodValidationPipe(slugSchema);

@Controller('casino')
export class CasinoController {
  constructor(@Inject(CasinoService) private readonly casino: CasinoService) {}

  @Get('lobby')
  lobby(): Promise<CasinoLobby> {
    return this.casino.lobby();
  }

  /** Filtered, paginated listing: ?category=&provider=&search=&page=&pageSize= */
  @Get('games')
  games(
    @Query(new ZodValidationPipe(gameListQuerySchema)) query: z.output<typeof gameListQuerySchema>,
  ): Promise<GamePage> {
    return this.casino.listGames(query);
  }

  @Get('games/:slug')
  game(@Param('slug', slug) gameSlug: string): Promise<GameDetail> {
    return this.casino.getGame(gameSlug);
  }

  @Post('games/:slug/launch')
  @HttpCode(200)
  launch(
    @Param('slug', slug) gameSlug: string,
    @Body(new ZodValidationPipe(gameLaunchRequestSchema)) request: GameLaunchRequest,
  ): Promise<GameLaunchResponse> {
    return this.casino.launch(gameSlug, request);
  }

  /** Real-money play: opens a game session for the signed-in player and returns its URL. */
  @Post('games/:slug/sessions')
  @HttpCode(200)
  @UseGuards(PlayerAuthGuard)
  openSession(
    @Param('slug', slug) gameSlug: string,
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(gameSessionRequestSchema)) request: GameSessionRequest,
  ): Promise<GameLaunchResponse> {
    return this.casino.openRealSession(gameSlug, playerId, request);
  }

  /** Providers with visible games; `?type=slot` limits to providers that have slots. */
  @Get('providers')
  providers(
    @Query('type', new ZodValidationPipe(gameTypeSchema.optional())) type?: GameType,
  ): Promise<Provider[]> {
    return this.casino.listProviders(type);
  }
}
