import type { GameTag, Locale } from '@metrobet/contracts';

export type DemoGame = {
  /** Provider's game code (used in the launch URL). */
  code: string;
  name: string;
  tags: GameTag[];
  volatility: 'low' | 'medium' | 'high';
  rtp: number;
  popularity: number;
  /** Official cover URL, or null to use generated art. */
  cover: string | null;
};

/**
 * One provider's free public demos (DEVELOPMENT ONLY; see PublicDemoAggregator).
 * Every code in `games` must be verified against the provider's demo launcher.
 */
export type DemoSource = {
  providerId: string;
  /** Prefix of our external game ids (`<prefix>:<code>`). Never change it: ids must stay stable. */
  idPrefix: string;
  providerName: string;
  games: DemoGame[];
  launchUrl(code: string, locale: Locale): string;
};
