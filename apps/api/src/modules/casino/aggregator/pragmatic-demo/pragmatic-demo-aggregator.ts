import { Inject, Injectable } from '@nestjs/common';

import { type AggregatorGame, GameAggregator, type LaunchParams } from '../game-aggregator.js';
import { MockGameAggregator } from '../mock/mock-aggregator.js';
import { PRAGMATIC_SLOTS } from './pragmatic-catalog.js';

const PROVIDER_ID = 'pragmatic-play';
const ID_PREFIX = 'pragmatic:';
const DEMO_LAUNCHER = 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do';
const THUMBNAILS = 'https://common-static.ppgames.net/game_pic/square/200';
const RELEASE_EPOCH = Date.UTC(2026, 9, 1);
const DAY = 24 * 60 * 60 * 1000;

/**
 * DEVELOPMENT ONLY. Real Pragmatic Play slots through Pragmatic's public free-demo launcher, for
 * internal demos before an aggregator contract exists. Showing a provider's games publicly needs
 * an agreement: in production, games come from the contracted aggregator (env validation refuses
 * `CASINO_AGGREGATOR=pragmatic-demo` when NODE_ENV=production).
 *
 * Non-slot games (crash, table) still come from the mock aggregator.
 */
@Injectable()
export class PragmaticDemoAggregator extends GameAggregator {
  constructor(@Inject(MockGameAggregator) private readonly mock: MockGameAggregator) {
    super();
  }

  async listProviders() {
    const games = await this.mock.listGames();
    const nonSlotStudios = new Set(
      games.filter((game) => game.type !== 'slot').map((game) => game.providerExternalId),
    );
    const mockProviders = (await this.mock.listProviders()).filter((provider) =>
      nonSlotStudios.has(provider.externalId),
    );
    return [{ externalId: PROVIDER_ID, name: 'Pragmatic Play' }, ...mockProviders];
  }

  async listGames(): Promise<AggregatorGame[]> {
    const slots: AggregatorGame[] = PRAGMATIC_SLOTS.map(
      ([symbol, name, tags, volatility, popularity], index) => ({
        externalId: `${ID_PREFIX}${symbol}`,
        providerExternalId: PROVIDER_ID,
        name,
        type: 'slot',
        thumbnail: `${THUMBNAILS}/${symbol}.png`,
        tags,
        rtp: 96.5,
        volatility,
        hasDemo: true,
        popularity,
        releasedAt: new Date(RELEASE_EPOCH - index * 11 * DAY),
      }),
    );
    const others = (await this.mock.listGames()).filter((game) => game.type !== 'slot');
    return [...slots, ...others];
  }

  launch(params: LaunchParams) {
    if (!params.externalGameId.startsWith(ID_PREFIX)) return this.mock.launch(params);
    const url = new URL(DEMO_LAUNCHER);
    url.search = new URLSearchParams({
      gameSymbol: params.externalGameId.slice(ID_PREFIX.length),
      lang: params.locale,
      cur: 'GEL',
      jurisdiction: '99',
      stylename: 'generic',
    }).toString();
    return Promise.resolve(url.toString());
  }
}
