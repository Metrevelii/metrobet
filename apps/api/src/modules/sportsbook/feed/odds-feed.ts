import type { EventDetail } from '@metrobet/contracts';

/** Receives the feed's view of the world. The store diffs it and pushes changes to clients. */
export interface FeedHandler {
  /** Full current state of an event (new or changed). */
  upsert(event: EventDetail): void;
  remove(eventId: string): void;
}

/**
 * Port for the odds feed (Betradar UOF, Genius, OddsMatrix… later). The simulated adapter
 * generates fixtures, prices and live matches so the sportsbook can be built without a contract.
 */
export abstract class OddsFeed {
  abstract start(handler: FeedHandler): void;
  abstract stop(): void;
}
