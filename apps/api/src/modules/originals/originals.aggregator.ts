import { ORIGINALS_PLAY_PATH, ORIGINALS_PROVIDER_ID, type OriginalGame } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import {
  type AggregatorGame,
  GameAggregator,
  type LaunchParams,
} from '../casino/aggregator/game-aggregator.js';
import { DemoWallet } from './wallet/demo-wallet.js';

/** Catalogue ids of Originals games: `originals:<game>`. */
export const ORIGINALS_ID_PREFIX = 'originals:';

const GAMES: Record<
  OriginalGame,
  Omit<AggregatorGame, 'externalId' | 'providerExternalId' | 'thumbnail'>
> = {
  'supra-fortune': {
    name: 'Supra Fortune',
    type: 'slot',
    tags: ['new'],
    rtp: 96.27,
    volatility: 'medium',
    hasDemo: true,
    hasRealMoney: true,
    popularity: 5000,
    releasedAt: new Date(Date.UTC(2026, 9, 29)),
  },
  'metro-jet': {
    name: 'Metro Jet',
    type: 'crash',
    tags: ['new'],
    rtp: 97,
    volatility: 'high',
    hasDemo: true,
    hasRealMoney: true,
    popularity: 5000,
    releasedAt: new Date(Date.UTC(2026, 9, 29)),
  },
  longshot: {
    name: 'Longshot',
    type: 'crash',
    tags: ['new'],
    rtp: 97,
    volatility: 'high',
    hasDemo: true,
    hasRealMoney: true,
    popularity: 4900,
    releasedAt: new Date(Date.UTC(2026, 9, 30)),
  },
};

/**
 * Metrobet Originals as a catalogue source, next to the bound aggregator (see
 * CombinedAggregator). Launch URLs point at the native web client (parsed with
 * `parseOriginalLaunch`); demo launches get a play-money session from DemoWallet.
 */
@Injectable()
export class OriginalsAggregator extends GameAggregator {
  private readonly baseUrl: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(DemoWallet) private readonly demo: DemoWallet,
  ) {
    super();
    this.baseUrl = config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  owns(externalGameId: string) {
    return externalGameId.startsWith(ORIGINALS_ID_PREFIX);
  }

  listProviders() {
    return Promise.resolve([{ externalId: ORIGINALS_PROVIDER_ID, name: 'Metrobet Originals' }]);
  }

  listGames() {
    return Promise.resolve(
      Object.entries(GAMES).map(([game, fields]) => ({
        ...fields,
        externalId: `${ORIGINALS_ID_PREFIX}${game}`,
        providerExternalId: ORIGINALS_PROVIDER_ID,
        thumbnail: `${this.baseUrl}/api/originals/art/${game}.svg`,
      })),
    );
  }

  launch({ externalGameId, mode, locale, sessionId }: LaunchParams) {
    const game = externalGameId.slice(ORIGINALS_ID_PREFIX.length);
    const url = new URL(`${this.baseUrl}${ORIGINALS_PLAY_PATH}${game}`);
    url.search = new URLSearchParams({
      session: mode === 'real' ? sessionId : this.demo.open(),
      mode,
      lang: locale,
    }).toString();
    return Promise.resolve(url.toString());
  }
}
