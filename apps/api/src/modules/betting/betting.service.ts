import {
  BET_LIMITS,
  type BetError,
  type CashoutResponse,
  cashoutValue,
  comboOdds,
  DEFAULT_CURRENCY,
  type PlaceBetsResponse,
  type placeBetsRequestSchema,
  payoutFor,
  type Ticket,
  type TicketsPage,
  type ticketsQuerySchema,
} from '@metrobet/contracts';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../config/env.js';
import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { ActivityBus } from '../activity/activity-bus.js';
import { PlayersService } from '../players/players.service.js';
import { SportsbookStore } from '../sportsbook/sportsbook.store.js';
import { InsufficientFundsError } from '../wallet/ledger-math.js';
import { Ledger } from '../wallet/ledger.js';
import {
  type BetSelectionRow,
  betSelections,
  type BetTicketRow,
  betTickets,
} from './betting.schema.js';

type PlaceRequest = z.output<typeof placeBetsRequestSchema>;
type TicketsQuery = z.output<typeof ticketsQuerySchema>;
type ProblemSelection = { selectionId: string; odds: number | null };

const STATUS: Record<BetError, HttpStatus> = {
  ODDS_CHANGED: HttpStatus.CONFLICT,
  CASHOUT_UNAVAILABLE: HttpStatus.CONFLICT,
  CASHOUT_CHANGED: HttpStatus.CONFLICT,
  SELECTION_UNAVAILABLE: HttpStatus.CONFLICT,
  SAME_EVENT: HttpStatus.BAD_REQUEST,
  STAKE_TOO_LOW: HttpStatus.BAD_REQUEST,
  STAKE_TOO_HIGH: HttpStatus.BAD_REQUEST,
  PAYOUT_TOO_HIGH: HttpStatus.BAD_REQUEST,
  INSUFFICIENT_FUNDS: HttpStatus.PAYMENT_REQUIRED,
  PLAYER_BLOCKED: HttpStatus.FORBIDDEN,
  DUPLICATE_REQUEST: HttpStatus.CONFLICT,
};

/** `{ code, message, selections? }` with the code's HTTP status (contracts `betErrorSchema`). */
export const betError = (
  code: BetError,
  message: string,
  selections?: ProblemSelection[],
  extra?: { cashout: number | null },
) =>
  new HttpException({ code, message, ...(selections && { selections }), ...extra }, STATUS[code]);

/** A selection priced from the store: the snapshot stored on the ticket. */
type Priced = Omit<typeof betSelections.$inferInsert, 'ticketId' | 'position'> & {
  live: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Places sportsbook tickets and lists them (rules in this module's CLAUDE.md). */
@Injectable()
export class BettingService {
  private readonly logger = new Logger(BettingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SportsbookStore) private readonly store: SportsbookStore,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(ActivityBus) private readonly activity: ActivityBus,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async place(playerId: string, request: PlaceRequest): Promise<PlaceBetsResponse> {
    const replay = await this.replay(playerId, request.idempotencyKey);
    if (replay) return replay;
    if ((await this.players.me(playerId)).status !== 'active') {
      throw betError('PLAYER_BLOCKED', 'This account cannot place bets');
    }

    let priced = this.price(request);
    if (priced.some((selection) => selection.live)) {
      // Live delay: wait, then price again, so nobody bets on what already happened.
      await sleep(this.config.get('BET_LIVE_DELAY_MS', { infer: true }));
      priced = this.price(request);
    }
    const drafts = (
      request.mode === 'single'
        ? priced.map((selection, index) => ({ stake: request.stakes[index]!, legs: [selection] }))
        : [{ stake: request.stakes[0]!, legs: priced }]
    ).map((draft, index) => {
      const odds = comboOdds(draft.legs.map((leg) => leg.odds));
      return { ...draft, index, odds, potentialWin: payoutFor(draft.stake, odds) };
    });
    for (const draft of drafts) {
      if (draft.stake < BET_LIMITS.minStake) throw betError('STAKE_TOO_LOW', 'Stake too low');
      if (draft.stake > BET_LIMITS.maxStake) throw betError('STAKE_TOO_HIGH', 'Stake too high');
      if (draft.potentialWin > BET_LIMITS.maxPayout) {
        throw betError('PAYOUT_TOO_HIGH', 'Potential win above the limit');
      }
    }

    let placed: { tickets: BetTicketRow[]; balance: number };
    try {
      placed = await this.db.transaction(async (tx) => {
        const tickets: BetTicketRow[] = [];
        let balance = 0;
        for (const draft of drafts) {
          const [ticket] = await tx
            .insert(betTickets)
            .values({
              playerId,
              requestKey: request.idempotencyKey,
              requestIndex: draft.index,
              mode: request.mode,
              stake: draft.stake,
              odds: draft.odds,
              potentialWin: draft.potentialWin,
            })
            .returning();
          await tx.insert(betSelections).values(
            draft.legs.map(({ live: _live, ...leg }, position) => ({
              ...leg,
              ticketId: ticket!.id,
              position,
            })),
          );
          ({ playerBalance: balance } = await this.ledger.post(
            {
              idempotencyKey: `sportsbook:bet:${ticket!.id}`,
              type: 'bet',
              playerId,
              legs: [
                { account: { kind: 'player', playerId }, amount: -draft.stake },
                { account: { kind: 'house' }, amount: draft.stake },
              ],
            },
            tx,
          ));
          tickets.push(ticket!);
        }
        return { tickets, balance };
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw betError('INSUFFICIENT_FUNDS', 'Not enough balance for these stakes');
      }
      // Same key submitted twice at once: the other request won, answer like a retry.
      const replayed = await this.replay(playerId, request.idempotencyKey);
      if (replayed) return replayed;
      throw error;
    }

    for (const ticket of placed.tickets) await this.publish(ticket, drafts[ticket.requestIndex]!);
    return { tickets: await this.toTickets(placed.tickets), balance: placed.balance };
  }

  async list(playerId: string, { status, page, pageSize }: TicketsQuery): Promise<TicketsPage> {
    const where = and(
      eq(betTickets.playerId, playerId),
      status === 'open'
        ? eq(betTickets.status, 'open')
        : status === 'settled'
          ? ne(betTickets.status, 'open')
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
    return { items: await this.toTickets(rows), total: total?.value ?? 0, page, pageSize };
  }

  /**
   * Prices every selection against the store. Throws SELECTION_UNAVAILABLE / ODDS_CHANGED with
   * all problem selections at once, so the betslip can show them together.
   */
  private price(request: PlaceRequest): Priced[] {
    const unavailable: ProblemSelection[] = [];
    const changed: ProblemSelection[] = [];
    const priced: Priced[] = [];
    for (const { selectionId, odds } of request.selections) {
      const found = this.store.findSelection(selectionId);
      if (
        !found ||
        found.event.status === 'ended' ||
        found.market.status !== 'open' ||
        !found.selection.active
      ) {
        unavailable.push({ selectionId, odds: found?.selection.odds ?? null });
        continue;
      }
      const { event, market, selection } = found;
      const current = selection.odds;
      if (current < odds || (current > odds && !request.acceptHigherOdds)) {
        changed.push({ selectionId, odds: current });
      }
      priced.push({
        selectionId,
        eventId: event.id,
        sport: event.sport,
        competition: event.competition.name,
        home: event.home.name,
        away: event.away.name,
        startsAt: new Date(event.startsAt),
        marketType: market.type,
        line: market.line,
        selectionKey: selection.key,
        odds: current,
        live: event.status === 'live',
      });
    }
    if (unavailable.length > 0) {
      throw betError('SELECTION_UNAVAILABLE', 'A selection can no longer be bet', unavailable);
    }
    if (changed.length > 0) throw betError('ODDS_CHANGED', 'Odds changed', changed);
    if (
      request.mode === 'combo' &&
      new Set(priced.map((item) => item.eventId)).size < priced.length
    ) {
      throw betError('SAME_EVENT', 'A combo needs selections from different events');
    }
    return priced;
  }

  /** The tickets of an earlier submission with this key, or null when it is new. */
  private async replay(playerId: string, requestKey: string): Promise<PlaceBetsResponse | null> {
    const rows = await this.db
      .select()
      .from(betTickets)
      .where(eq(betTickets.requestKey, requestKey))
      .orderBy(betTickets.requestIndex);
    if (rows.length === 0) return null;
    if (rows.some((row) => row.playerId !== playerId)) {
      throw betError('DUPLICATE_REQUEST', 'This request key was already used');
    }
    return {
      tickets: await this.toTickets(rows),
      balance: await this.ledger.playerBalance(playerId),
    };
  }

  async toTickets(rows: BetTicketRow[]): Promise<Ticket[]> {
    if (rows.length === 0) return [];
    const selections = await this.db
      .select()
      .from(betSelections)
      .where(
        inArray(
          betSelections.ticketId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(betSelections.position);
    const byTicket = new Map<string, BetSelectionRow[]>();
    for (const selection of selections) {
      byTicket.set(selection.ticketId, [...(byTicket.get(selection.ticketId) ?? []), selection]);
    }
    return rows.map((row) => {
      const legs = (byTicket.get(row.id) ?? []).map((selection) => ({
        selectionId: selection.selectionId,
        eventId: selection.eventId,
        sport: selection.sport,
        competition: selection.competition,
        home: selection.home,
        away: selection.away,
        startsAt: selection.startsAt.toISOString(),
        marketType: selection.marketType,
        line: selection.line,
        selectionKey: selection.selectionKey,
        odds: selection.odds,
        result: selection.result,
        currentOdds:
          row.status === 'open' && selection.result === null
            ? this.liveOdds(selection.selectionId)
            : null,
      }));
      return {
        id: row.id,
        mode: row.mode,
        stake: row.stake,
        odds: row.odds,
        potentialWin: row.potentialWin,
        status: row.status,
        payout: row.payout,
        placedAt: row.placedAt.toISOString(),
        settledAt: row.settledAt?.toISOString() ?? null,
        selections: legs,
        cashout: row.status === 'open' ? cashoutValue(row.stake, row.potentialWin, legs) : null,
      };
    });
  }

  /**
   * Sells an open ticket back at the current offer (rules in CLAUDE.md, cash-out). `amount` is
   * what the player saw: a lower offer is refused with the new amount, a higher one is paid.
   */
  async cashout(playerId: string, ticketId: string, amount: number): Promise<CashoutResponse> {
    const [found] = await this.db
      .select()
      .from(betTickets)
      .where(and(eq(betTickets.id, ticketId), eq(betTickets.playerId, playerId)));
    if (!found) throw new NotFoundException('Ticket not found');
    const live = (await this.toTickets([found]))[0]!.selections.some(
      (selection) =>
        selection.result === null &&
        this.store.findSelection(selection.selectionId)?.event.status === 'live',
    );
    // Same delay as live bets: the offer is checked again after it.
    if (live) await sleep(this.config.get('BET_LIVE_DELAY_MS', { infer: true }));

    const paid = await this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(betTickets)
        .where(eq(betTickets.id, ticketId))
        .for('update');
      if (ticket?.status !== 'open') {
        throw betError('CASHOUT_UNAVAILABLE', 'The ticket is no longer open');
      }
      const selections = await tx
        .select({
          selectionId: betSelections.selectionId,
          odds: betSelections.odds,
          result: betSelections.result,
        })
        .from(betSelections)
        .where(eq(betSelections.ticketId, ticketId));
      const offer = cashoutValue(
        ticket.stake,
        ticket.potentialWin,
        selections.map((selection) => ({
          ...selection,
          currentOdds: selection.result === null ? this.liveOdds(selection.selectionId) : null,
        })),
      );
      if (offer === null) throw betError('CASHOUT_UNAVAILABLE', 'Cash-out is not available now');
      if (offer < amount) {
        throw betError('CASHOUT_CHANGED', 'The cash-out amount changed', undefined, {
          cashout: offer,
        });
      }
      const { playerBalance } = await this.ledger.post(
        {
          idempotencyKey: `sportsbook:cashout:${ticket.id}`,
          type: 'cashout',
          playerId,
          legs: [
            { account: { kind: 'house' }, amount: -offer },
            { account: { kind: 'player', playerId }, amount: offer },
          ],
        },
        tx,
      );
      const [updated] = await tx
        .update(betTickets)
        .set({ status: 'cashed_out', payout: offer, settledAt: new Date() })
        .where(eq(betTickets.id, ticket.id))
        .returning();
      return { ticket: updated!, balance: playerBalance };
    });
    return { ticket: (await this.toTickets([paid.ticket]))[0]!, balance: paid.balance };
  }

  /** The price a selection can be bet at right now, or null (suspended, closed, gone). */
  private liveOdds(selectionId: string): number | null {
    const found = this.store.findSelection(selectionId);
    if (
      !found ||
      found.event.status === 'ended' ||
      found.market.status !== 'open' ||
      !found.selection.active
    ) {
      return null;
    }
    return found.selection.odds;
  }

  /** Promotions and other subscribers count sportsbook stakes. Never undoes the bet. */
  private async publish(ticket: BetTicketRow, draft: { legs: Priced[] }) {
    try {
      await this.activity.publish({
        id: `sportsbook:${ticket.id}`,
        kind: 'sports.bet',
        playerId: ticket.playerId,
        occurredAt: ticket.placedAt.toISOString(),
        amount: ticket.stake,
        currency: DEFAULT_CURRENCY,
        mode: ticket.mode,
        odds: ticket.odds,
        sports: [...new Set(draft.legs.map((leg) => leg.sport))],
      });
    } catch (error) {
      this.logger.error(`Failed to publish ticket ${ticket.id}`, error);
    }
  }
}
