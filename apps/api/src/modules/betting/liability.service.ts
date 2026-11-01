import type { EventLiability, EventLiabilitySummary } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { betSelections, betTickets } from './betting.schema.js';
import { liabilityOf, type OpenLeg } from './liability.js';

/** Liability of open tickets per event, for the backoffice trading screens. */
@Injectable()
export class LiabilityService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async summaries(eventIds: string[]): Promise<EventLiabilitySummary[]> {
    const legs = await this.openLegs(eventIds);
    return eventIds.map((id) => {
      const { markets: _markets, ...summary } = liabilityOf(id, legs);
      return summary;
    });
  }

  async event(eventId: string): Promise<EventLiability> {
    return liabilityOf(eventId, await this.openLegs([eventId]));
  }

  private openLegs(eventIds: string[]): Promise<OpenLeg[]> {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({
        ticketId: betTickets.id,
        mode: betTickets.mode,
        stake: betTickets.stake,
        potentialWin: betTickets.potentialWin,
        eventId: betSelections.eventId,
        selectionId: betSelections.selectionId,
      })
      .from(betSelections)
      .innerJoin(betTickets, eq(betTickets.id, betSelections.ticketId))
      .where(
        and(
          inArray(betSelections.eventId, eventIds),
          isNull(betSelections.result),
          eq(betTickets.status, 'open'),
        ),
      );
  }
}
