import { randomUUID } from 'node:crypto';

import {
  CASINO_CATEGORIES,
  type CasinoLobby,
  type GameDetail,
  type GameLaunchRequest,
  type GameLaunchResponse,
  type GamePage,
  type GameType,
  gameListQuerySchema,
  type Provider,
} from '@metrobet/contracts';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';

import { GameAggregator } from './aggregator/game-aggregator.js';
import { CasinoCatalog } from './casino.catalog.js';

const LOBBY_ROW_SIZE = 12;

@Injectable()
export class CasinoService {
  constructor(
    @Inject(CasinoCatalog) private readonly catalog: CasinoCatalog,
    @Inject(GameAggregator) private readonly aggregator: GameAggregator,
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
    const { externalId: _externalId, ...detail } = game;
    return detail;
  }

  async launch(slug: string, { mode, locale }: GameLaunchRequest): Promise<GameLaunchResponse> {
    const game = await this.catalog.findGame(slug);
    if (!game) throw new NotFoundException(`Game "${slug}" not found`);
    // Real-money play needs a player session and wallet (roadmap step 7).
    if (mode === 'real') throw new UnauthorizedException('Log in to play for real money');
    if (!game.hasDemo) throw new BadRequestException('This game has no demo mode');

    const url = await this.aggregator.launch({
      externalGameId: game.externalId,
      mode,
      locale,
      sessionId: randomUUID(),
    });
    return { url };
  }
}
