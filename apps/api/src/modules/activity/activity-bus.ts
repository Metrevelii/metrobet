import type { ActivityEvent } from '@metrobet/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { activityEvents } from './activity.schema.js';

export type ActivityHandler = (event: ActivityEvent) => Promise<void>;

/**
 * In-process activity bus. `publish` records the event (idempotent by id), then runs every
 * subscriber in turn. A failing subscriber is logged and does not stop the others or the
 * producer. Not transactional with subscribers: when we scale out, move delivery to a queue
 * (BullMQ) reading the same table.
 */
@Injectable()
export class ActivityBus {
  private readonly logger = new Logger(ActivityBus.name);
  private readonly handlers = new Set<ActivityHandler>();

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Returns an unsubscribe function. */
  subscribe(handler: ActivityHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Returns false when the event id was already recorded (nothing is dispatched again). */
  async publish(event: ActivityEvent): Promise<boolean> {
    const inserted = await this.db
      .insert(activityEvents)
      .values({
        id: event.id,
        kind: event.kind,
        playerId: event.playerId,
        payload: event,
        occurredAt: new Date(event.occurredAt),
      })
      .onConflictDoNothing()
      .returning({ id: activityEvents.id });
    if (inserted.length === 0) return false;

    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Handler failed for ${event.kind} ${event.id}`, error);
      }
    }
    return true;
  }
}
