import type { GameMode, GameTag, GameType, Locale } from '@metrobet/contracts';

export type AggregatorProvider = { externalId: string; name: string };

export type AggregatorGame = {
  externalId: string;
  providerExternalId: string;
  name: string;
  type: GameType;
  thumbnail: string;
  tags: GameTag[];
  rtp: number | null;
  volatility: 'low' | 'medium' | 'high' | null;
  hasDemo: boolean;
  popularity: number;
  releasedAt: Date;
};

export type LaunchParams = {
  externalGameId: string;
  mode: GameMode;
  locale: Locale;
  /** Our session reference, echoed back in provider callbacks (wallet, later). */
  sessionId: string;
};

/**
 * Port for the casino aggregator (Slotegrator, SoftSwiss, Hub88… not chosen yet).
 * The mock adapter serves a fake catalogue and demo games so the product can be built now.
 */
export abstract class GameAggregator {
  abstract listProviders(): Promise<AggregatorProvider[]>;
  abstract listGames(): Promise<AggregatorGame[]>;
  /** Returns the URL to load in the game iframe. */
  abstract launch(params: LaunchParams): Promise<string>;
}
