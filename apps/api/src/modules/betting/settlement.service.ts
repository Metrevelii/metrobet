import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import type { Env } from '../../config/env.js';
import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { type EventResult, OddsFeed } from '../sportsbook/feed/odds-feed.js';
import { Ledger } from '../wallet/ledger.js';
import { betSelections, betTickets } from './betting.schema.js';
import { selectionResult, ticketOutcome } from './settlement-rules.js';

const SETTLE_EVERY_MS = 15_000;
const BATCH = 500;

/**
 * Settles sportsbook tickets from feed results (rules in this module's CLAUDE.md, #6–#8). Runs
 * every 15 s (`BET_SETTLEMENT=on`); e2e tests call `run()` / `settleEvent()` by hand.
 */
@Injectable()
export class SettlementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(OddsFeed) private readonly feed: OddsFeed,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    if (this.config.get('BET_SETTLEMENT', { infer: true }) === 'on') {
      this.timer = setInterval(() => void this.run(), SETTLE_EVERY_MS);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass: results for every event with open selections, then any ticket left open. */
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.db
        .selectDistinct({ eventId: betSelections.eventId })
        .from(betSelections)
        .where(isNull(betSelections.result))
        .limit(BATCH);
      for (const { eventId } of events) {
        const result = await this.feed.result(eventId);
        if (result) await this.settleEvent(result);
      }
      // Tickets whose selections were resolved earlier but that are still open (e.g. a crash
      // between the two steps).
      const pending = await this.db
        .selectDistinct({ id: betTickets.id })
        .from(betTickets)
        .innerJoin(betSelections, eq(betSelections.ticketId, betTickets.id))
        .where(and(eq(betTickets.status, 'open'), isNotNull(betSelections.result)))
        .limit(BATCH);
      for (const { id } of pending) await this.settleTicket(id);
    } catch (error) {
      this.logger.error('Settlement pass failed', error);
    } finally {
      this.running = false;
    }
  }

  /** Resolves every open selection of a finished event, then settles the affected tickets. */
  async settleEvent(result: EventResult): Promise<void> {
    const open = await this.db
      .select()
      .from(betSelections)
      .where(and(eq(betSelections.eventId, result.eventId), isNull(betSelections.result)));
    const settledAt = new Date();
    for (const selection of open) {
      await this.db
        .update(betSelections)
        .set({ result: selectionResult(selection, result.final), settledAt })
        .where(and(eq(betSelections.id, selection.id), isNull(betSelections.result)));
    }
    for (const ticketId of new Set(open.map((selection) => selection.ticketId))) {
      await this.settleTicket(ticketId);
    }
  }

  /** Settles one ticket if its outcome is known. Locked, and only while still open. */
  async settleTicket(ticketId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(betTickets)
        .where(eq(betTickets.id, ticketId))
        .for('update');
      if (ticket?.status !== 'open') return;
      const selections = await tx
        .select({ odds: betSelections.odds, result: betSelections.result })
        .from(betSelections)
        .where(eq(betSelections.ticketId, ticketId));
      const outcome = ticketOutcome(ticket.stake, selections);
      if (outcome.status === 'open') return;

      if (outcome.payout > 0) {
        const refund = outcome.status === 'void';
        await this.ledger.post(
          {
            idempotencyKey: `sportsbook:${refund ? 'refund' : 'win'}:${ticket.id}`,
            type: refund ? 'rollback' : 'win',
            playerId: ticket.playerId,
            legs: [
              { account: { kind: 'house' }, amount: -outcome.payout },
              { account: { kind: 'player', playerId: ticket.playerId }, amount: outcome.payout },
            ],
          },
          tx,
        );
      }
      await tx
        .update(betTickets)
        .set({ status: outcome.status, payout: outcome.payout, settledAt: new Date() })
        .where(eq(betTickets.id, ticket.id));
    });
  }
}
