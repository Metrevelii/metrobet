import { Inject, Injectable } from '@nestjs/common';

import { type AggregatorGame, GameAggregator, type LaunchParams } from '../game-aggregator.js';
import { MockGameAggregator } from '../mock/mock-aggregator.js';
import { bgamingSource } from './bgaming.source.js';
import type { DemoSource } from './demo-source.js';
import { pragmaticSource } from './pragmatic.source.js';

/** Add a provider with free public demos here (verify every game code first). */
export const DEMO_SOURCES: DemoSource[] = [pragmaticSource, bgamingSource];

const RELEASE_EPOCH = Date.UTC(2026, 9, 1);
const DAY = 24 * 60 * 60 * 1000;
const externalId = (source: DemoSource, code: string) => `${source.idPrefix}:${code}`;

/**
 * DEVELOPMENT ONLY. Real slots from providers' free public demos (Pragmatic Play, BGaming), for
 * internal demos before an aggregator contract exists. Showing a provider's games publicly needs
 * an agreement: in production, games come from the contracted aggregator (env validation refuses
 * `CASINO_AGGREGATOR=public-demos` when NODE_ENV=production).
 *
 * Non-slot games (crash, table) still come from the mock aggregator.
 */
@Injectable()
export class PublicDemoAggregator extends GameAggregator {
  constructor(@Inject(MockGameAggregator) private readonly mock: MockGameAggregator) {
    super();
  }

  async listProviders() {
    const nonSlotStudios = new Set(
      (await this.mockNonSlotGames()).map((game) => game.providerExternalId),
    );
    const mockProviders = (await this.mock.listProviders()).filter((provider) =>
      nonSlotStudios.has(provider.externalId),
    );
    return [
      ...DEMO_SOURCES.map((source) => ({
        externalId: source.providerId,
        name: source.providerName,
      })),
      ...mockProviders,
    ];
  }

  async listGames(): Promise<AggregatorGame[]> {
    const slots = DEMO_SOURCES.flatMap((source) =>
      source.games.map((game, index) => ({
        externalId: externalId(source, game.code),
        providerExternalId: source.providerId,
        name: game.name,
        type: 'slot' as const,
        thumbnail: game.cover ?? this.mock.artUrl(game.name, source.providerName),
        tags: game.tags,
        rtp: game.rtp,
        volatility: game.volatility,
        hasDemo: true,
        popularity: game.popularity,
        releasedAt: new Date(RELEASE_EPOCH - index * 11 * DAY),
      })),
    );
    return [...slots, ...(await this.mockNonSlotGames())];
  }

  launch(params: LaunchParams) {
    for (const source of DEMO_SOURCES) {
      const prefix = `${source.idPrefix}:`;
      if (params.externalGameId.startsWith(prefix)) {
        return Promise.resolve(
          source.launchUrl(params.externalGameId.slice(prefix.length), params.locale),
        );
      }
    }
    return this.mock.launch(params);
  }

  private async mockNonSlotGames() {
    return (await this.mock.listGames()).filter((game) => game.type !== 'slot');
  }
}
