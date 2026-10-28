import { randomUUID } from 'node:crypto';

import {
  CASINO_CATEGORIES,
  type CasinoLobby,
  type GameDetail,
  type GameLaunchRequest,
  type GameLaunchResponse,
  type GameSessionRequest,
  type GamePage,
  type GameType,
  gameListQuerySchema,
  type Provider,
} from '@metrobet/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { z } from 'zod';

import { GameAggregator } from './aggregator/game-aggregator.js';
import { PlayersService } from '../players/players.service.js';
import { CasinoCatalog } from './casino.catalog.js';
import { GameSessions } from './game-sessions.js';

const LOBBY_ROW_SIZE = 12;

@Injectable()
export class CasinoService {
  constructor(
    @Inject(CasinoCatalog) private readonly catalog: CasinoCatalog,
    @Inject(GameAggregator) private readonly aggregator: GameAggregator,
    @Inject(GameSessions) private readonly sessions: GameSessions,
    @Inject(PlayersService) private readonly players: PlayersService,
  ) {}

  /** Slots lobby: one row per category (empty ones left out) plus providers that have slots. */
  async lobby(): Promise<CasinoLobby> {
    const [sections, providers] = await Promise.all([
      Promise.all(
        CASINO_CATEGORIES.map(async (category) => ({
          category,
          games: (await this.catalog.listGames({ type: 'slot', category }, 1, LOBBY_ROW_SIZE))
            .items,
        })),
      ),
      this.catalog.listProviders('slot'),
    ]);
    return { sections: sections.filter((section) => section.games.length > 0), providers };
  }

  listGames({
    page,
    pageSize,
    ...filter
  }: z.output<typeof gameListQuerySchema>): Promise<GamePage> {
    return this.catalog.listGames(filter, page, pageSize);
  }

  listProviders(type?: GameType): Promise<Provider[]> {
    return this.catalog.listProviders(type);
  }

  async getGame(slug: string): Promise<GameDetail> {
    const game = await this.catalog.findGame(slug);
    if (!game) throw new NotFoundException(`Game "${slug}" not found`);
    const { id: _id, externalId: _externalId, ...detail } = game;
    return detail;
  }

  async launch(slug: string, { mode, locale }: GameLaunchRequest): Promise<GameLaunchResponse> {
    const game = await this.catalog.findGame(slug);
    if (!game) throw new NotFoundException(`Game "${slug}" not found`);
    if (mode === 'real') {
      throw new BadRequestException('Real-money play opens a session: POST games/:slug/sessions');
    }
    if (!game.hasDemo) throw new BadRequestException('This game has no demo mode');

    const url = await this.aggregator.launch({
      externalGameId: game.externalId,
      mode,
      locale,
      sessionId: randomUUID(),
    });
    return { url };
  }

  /**
   * Real-money launch for a signed-in player: opens a game session whose token the provider
   * sends back in every game wallet call (bets, wins, rollbacks).
   */
  async openRealSession(
    slug: string,
    playerId: string,
    { locale }: GameSessionRequest,
  ): Promise<GameLaunchResponse> {
    const game = await this.catalog.findGame(slug);
    if (!game) throw new NotFoundException(`Game "${slug}" not found`);
    if (!game.hasRealMoney) throw new BadRequestException('This game is demo only');
    if ((await this.players.me(playerId)).status !== 'active') {
      throw new ForbiddenException('Your account cannot play for real money');
    }

    const url = await this.aggregator.launch({
      externalGameId: game.externalId,
      mode: 'real',
      locale,
      sessionId: await this.sessions.open(playerId, game.id),
    });
    return { url };
  }
}
