import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../../../config/env.js';
import { type AggregatorGame, GameAggregator, type LaunchParams } from '../game-aggregator.js';
import { hash, MOCK_PROVIDERS, mockTags } from './mock-catalog.js';

const DAY = 24 * 60 * 60 * 1000;
const RELEASE_EPOCH = Date.UTC(2026, 9, 1);

/** Gives each mock game a stable id like `golden-fleece:argonauts-gold`. */
export const mockGameId = (providerId: string, title: string) =>
  `${providerId}:${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

export function findMockGame(externalId: string) {
  for (const provider of MOCK_PROVIDERS) {
    const title = provider.games.find((game) => mockGameId(provider.id, game) === externalId);
    if (title) return { provider, title };
  }
  return null;
}

@Injectable()
export class MockGameAggregator extends GameAggregator {
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.baseUrl = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/casino/mock`;
  }

  listProviders() {
    return Promise.resolve(MOCK_PROVIDERS.map(({ id, name }) => ({ externalId: id, name })));
  }

  listGames() {
    const games: AggregatorGame[] = MOCK_PROVIDERS.flatMap((provider) =>
      provider.games.map((title, index) => {
        const externalId = mockGameId(provider.id, title);
        const h = hash(externalId);
        return {
          externalId,
          providerExternalId: provider.id,
          name: title,
          type: provider.type,
          thumbnail: `${this.baseUrl}/thumbnails/${encodeURIComponent(externalId)}.svg`,
          tags: mockTags(title),
          rtp: provider.type === 'crash' ? 97 : 94 + (h % 36) / 10,
          volatility: (['low', 'medium', 'high'] as const)[h % 3]!,
          hasDemo: true,
          popularity: h % 1000,
          releasedAt: new Date(RELEASE_EPOCH - (index * 9 + (h % 9)) * DAY),
        };
      }),
    );
    return Promise.resolve(games);
  }

  launch({ externalGameId, mode, locale, sessionId }: LaunchParams) {
    const url = new URL(`${this.baseUrl}/play/${encodeURIComponent(externalGameId)}`);
    url.search = new URLSearchParams({ mode, lang: locale, session: sessionId }).toString();
    return Promise.resolve(url.toString());
  }
}
