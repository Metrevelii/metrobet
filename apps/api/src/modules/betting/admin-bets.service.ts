import {
  type AdminTicket,
  type AdminTicketsPage,
  type adminTicketsQuerySchema,
  type SelectionSettleInput,
  type TicketVoidInput,
} from '@metrobet/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, exists, isNull } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { AdminPlayersService } from '../players/admin-players.service.js';
import { Ledger } from '../wallet/ledger.js';
import { type BetTicketRow, betSelections, betTickets } from './betting.schema.js';
import { BettingService } from './betting.service.js';
import { SettlementService } from './settlement.service.js';

type TicketsQuery = z.output<typeof adminTicketsQuerySchema>;

/**
 * Staff operations on sportsbook tickets: search, void, and settling a selection by hand when the
 * feed result is wrong or missing. Every change is audit-logged (rules in CLAUDE.md).
 */
@Injectable()
export class AdminBetsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(BettingService) private readonly betting: BettingService,
    @Inject(SettlementService) private readonly settlement: SettlementService,
    @Inject(AdminPlayersService) private readonly players: AdminPlayersService,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list({ status, sport, playerId, page, pageSize }: TicketsQuery): Promise<AdminTicketsPage> {
    const where = and(
      status ? eq(betTickets.status, status) : undefined,
      playerId ? eq(betTickets.playerId, playerId) : undefined,
      sport
        ? exists(
            this.db
              .select({ id: betSelections.id })
              .from(betSelections)
              .where(
                and(eq(betSelections.ticketId, betTickets.id), eq(betSelections.sport, sport)),
              ),
          )
        : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(betTickets)
        .where(where)
        .orderBy(desc(betTickets.placedAt), desc(betTickets.requestIndex))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(betTickets).where(where),
    ]);
    return { items: await this.withPlayers(rows), total: total?.value ?? 0, page, pageSize };
  }

  async get(id: string): Promise<AdminTicket> {
    const [ticket] = await this.withPlayers([await this.find(id)]);
    return ticket!;
  }

  /** Voids an open ticket: the stake goes back (same ledger key as a void settlement). */
  async void(actor: string, id: string, { reason }: TicketVoidInput): Promise<AdminTicket> {
    const before = await this.find(id);
    await this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(betTickets)
        .where(eq(betTickets.id, id))
        .for('update');
      if (ticket?.status !== 'open') throw new ConflictException('Only open tickets can be voided');
      await this.ledger.post(
        {
          idempotencyKey: `sportsbook:refund:${id}`,
          type: 'rollback',
          playerId: ticket.playerId,
          legs: [
            { account: { kind: 'house' }, amount: -ticket.stake },
            { account: { kind: 'player', playerId: ticket.playerId }, amount: ticket.stake },
          ],
        },
        tx,
      );
      await tx
        .update(betTickets)
        .set({ status: 'void', payout: ticket.stake, settledAt: new Date() })
        .where(eq(betTickets.id, id));
    });
    await this.audit.record({
      actor,
      action: 'ticket.void',
      entityType: 'ticket',
      entityId: id,
      before: { status: before.status },
      after: { status: 'void', payout: before.stake, reason },
    });
    return this.get(id);
  }

  /**
   * Settles one unresolved selection of this ticket by hand, then settles the ticket if its
   * outcome is now known. Settled selections are not changed (that would need reversing payouts).
   */
  async settleSelection(
    actor: string,
    id: string,
    selectionId: string,
    { result, reason }: SelectionSettleInput,
  ): Promise<AdminTicket> {
    const ticket = await this.find(id);
    if (ticket.status !== 'open') throw new ConflictException('The ticket is already settled');
    const [updated] = await this.db
      .update(betSelections)
      .set({ result, settledAt: new Date() })
      .where(
        and(
          eq(betSelections.ticketId, id),
          eq(betSelections.selectionId, selectionId),
          isNull(betSelections.result),
        ),
      )
      .returning({ id: betSelections.id });
    if (!updated) throw new ConflictException('No unresolved selection with this id on the ticket');
    await this.settlement.settleTicket(id);
    await this.audit.record({
      actor,
      action: 'ticket.settle-selection',
      entityType: 'ticket',
      entityId: id,
      before: { selectionId, result: null },
      after: { selectionId, result, reason },
    });
    return this.get(id);
  }

  /** Open tickets right now (dashboard). */
  async countOpen(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(betTickets)
      .where(eq(betTickets.status, 'open'));
    return row?.value ?? 0;
  }

  private async find(id: string): Promise<BetTicketRow> {
    const [row] = await this.db.select().from(betTickets).where(eq(betTickets.id, id));
    if (!row) throw new NotFoundException('Ticket not found');
    return row;
  }

  private async withPlayers(rows: BetTicketRow[]): Promise<AdminTicket[]> {
    const [tickets, contacts] = await Promise.all([
      this.betting.toTickets(rows),
      this.players.contacts([...new Set(rows.map((row) => row.playerId))]),
    ]);
    return tickets.map((ticket, index) => {
      const playerId = rows[index]!.playerId;
      const contact = contacts.get(playerId);
      return {
        ...ticket,
        player: { id: playerId, email: contact?.email ?? null, phone: contact?.phone ?? null },
      };
    });
  }
}
