import { GameAggregator, type LaunchParams } from './game-aggregator.js';

/** A catalogue source that is merged with the main aggregator and launches its own games. */
export type GameSource = GameAggregator & { owns(externalGameId: string): boolean };

/**
 * The bound aggregator plus first-party sources (Metrobet Originals): catalogues are merged, and
 * each launch goes to the source that owns the game id.
 */
export class CombinedAggregator extends GameAggregator {
  constructor(
    private readonly main: GameAggregator,
    private readonly sources: GameSource[],
  ) {
    super();
  }

  async listProviders() {
    const lists = await Promise.all(
      [this.main, ...this.sources].map((source) => source.listProviders()),
    );
    return lists.flat();
  }

  async listGames() {
    const lists = await Promise.all(
      [this.main, ...this.sources].map((source) => source.listGames()),
    );
    return lists.flat();
  }

  launch(params: LaunchParams) {
    const source = this.sources.find((item) => item.owns(params.externalGameId)) ?? this.main;
    return source.launch(params);
  }
}
