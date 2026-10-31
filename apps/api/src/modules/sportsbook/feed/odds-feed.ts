import type { EventDetail, LiveState, Sport } from '@metrobet/contracts';

/** Receives the feed's view of the world. The store diffs it and pushes changes to clients. */
export interface FeedHandler {
  /** Full current state of an event (new or changed). */
  upsert(event: EventDetail): void;
  remove(eventId: string): void;
}

/** Final state of a finished event: what bets on it are settled against. */
export type EventResult = { eventId: string; sport: Sport; final: LiveState };

/**
 * Port for the odds feed (Betradar UOF, Genius, OddsMatrix… later). The simulated adapter
 * generates fixtures, prices and live matches so the sportsbook can be built without a contract.
 */
export abstract class OddsFeed {
  abstract start(handler: FeedHandler): void;
  abstract stop(): void;
  /**
   * The final result once the event is over (null while it is not, or for unknown ids). Asked by
   * bet settlement at any time, also long after the event left the live lists. A licensed feed
   * answers from its results/settlement API.
   */
  abstract result(eventId: string): Promise<EventResult | null>;
}
