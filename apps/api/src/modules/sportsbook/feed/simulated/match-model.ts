import type { EventStatus, LiveState, Market } from '@metrobet/contracts';

export type MatchState = { status: EventStatus; live: LiveState | null; markets: Market[] };

/** A pre-generated match: its whole timeline is fixed at creation, so state is a pure function of time. */
export interface MatchModel {
  /** Real-time length from kick-off to the final whistle. */
  durationMs: number;
  /** State at `elapsedMs` after kick-off (negative = not started). `now` drives price drift. */
  stateAt(eventId: string, elapsedMs: number, now: number): MatchState;
}
