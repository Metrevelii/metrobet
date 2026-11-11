import {
  type AdminPayment,
  type AdminPaymentsPage,
  type adminPaymentsQuerySchema,
  type DepositInput,
  type DepositStarted,
  type LimitExceeded,
  PAYMENT_LIMITS,
  type Payment,
  type PaymentCallback,
  type PaymentError,
  type PaymentsPage,
  type paymentsQuerySchema,
  type SavedCard,
  type WithdrawalInput,
} from '@metrobet/contracts';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, lt } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../config/env.js';
import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { StaffDirectory } from '../auth/staff-directory.js';
import { AdminPlayersService } from '../players/admin-players.service.js';
import { PlayersService } from '../players/players.service.js';
import {
  LimitExceededError,
  ResponsibleGamingService,
} from '../responsible-gaming/responsible-gaming.service.js';
import { InsufficientFundsError } from '../wallet/ledger-math.js';
import { Ledger, type Tx } from '../wallet/ledger.js';
import { GatewayUnavailableError, PaymentGateway } from './gateway/payment-gateway.js';
import { type PaymentRow, payments, type SavedCardRow, savedCards } from './payments.schema.js';

const STATUS: Record<PaymentError, HttpStatus> = {
  INSUFFICIENT_FUNDS: HttpStatus.PAYMENT_REQUIRED,
  LIMIT_EXCEEDED: HttpStatus.FORBIDDEN,
  UNVERIFIED: HttpStatus.FORBIDDEN,
  CARD_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOT_CANCELLABLE: HttpStatus.CONFLICT,
  GATEWAY_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
};

/** `{ code, message, limit? }` with the code's HTTP status. */
export const paymentError = (code: PaymentError, message: string, limit?: LimitExceeded) =>
  new HttpException({ code, message, ...(limit && { limit }) }, STATUS[code]);

const toPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  kind: row.kind,
  provider: row.provider,
  amount: row.amount,
  status: row.status,
  cardMask: row.cardMask,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

/** Staff id of a `staff:<id>` audit actor. */
const staffId = (actor: string | null) => /^staff:(.+)$/.exec(actor ?? '')?.[1];

const toCard = (row: SavedCardRow): SavedCard => ({
  id: row.id,
  provider: row.provider,
  mask: row.mask,
  brand: row.brand,
  expiry: row.expiry,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Deposits and withdrawals (rules in this module's CLAUDE.md). Money only moves through
 * `Ledger.post`, keyed by the payment id, inside the same DB transaction as the status change.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly webUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(PaymentGateway) private readonly gateway: PaymentGateway,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(AdminPlayersService) private readonly adminPlayers: AdminPlayersService,
    @Inject(ResponsibleGamingService) private readonly rg: ResponsibleGamingService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(StaffDirectory) private readonly staff: StaffDirectory,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  // ── Player ─────────────────────────────────────────────────────────────────────────────────

  /** Checks the deposit limits, records a pending deposit and asks the bank for its card page. */
  async startDeposit(
    playerId: string,
    { provider, amount }: DepositInput,
  ): Promise<DepositStarted> {
    try {
      await this.rg.assertCanDeposit(playerId, amount);
    } catch (error) {
      if (!(error instanceof LimitExceededError)) throw error;
      throw paymentError('LIMIT_EXCEEDED', error.message, error.limit);
    }
    const [row] = await this.db
      .insert(payments)
      .values({ playerId, kind: 'deposit', provider, amount })
      .returning();
    const { redirectUrl } = await this.gateway.startDeposit({
      paymentId: row!.id,
      provider,
      amount,
      returnUrl: `${this.webUrl}/wallet?payment=${row!.id}`,
    });
    return { payment: toPayment(row!), redirectUrl };
  }

  /**
   * Reserves the amount (player → `withdrawals`) and queues the withdrawal for staff. Paid back
   * to a card the player deposited with; needs a confirmed contact.
   */
  async requestWithdrawal(playerId: string, { cardId, amount }: WithdrawalInput): Promise<Payment> {
    if (!(await this.players.me(playerId)).verified) {
      throw paymentError('UNVERIFIED', 'Confirm your email or phone before withdrawing');
    }
    const [card] = await this.db
      .select()
      .from(savedCards)
      .where(and(eq(savedCards.id, cardId), eq(savedCards.playerId, playerId)));
    if (!card) throw paymentError('CARD_NOT_FOUND', 'Card not found');
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(payments)
          .values({
            playerId,
            kind: 'withdrawal',
            provider: card.provider,
            amount,
            cardId: card.id,
            cardMask: card.mask,
          })
          .returning();
        await this.ledger.post(
          {
            idempotencyKey: `payment:${row!.id}:hold`,
            type: 'withdrawal',
            playerId,
            legs: [
              { account: { kind: 'player', playerId }, amount: -amount },
              { account: { kind: 'withdrawals' }, amount },
            ],
          },
          tx,
        );
        return toPayment(row!);
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw paymentError('INSUFFICIENT_FUNDS', 'Not enough balance for this withdrawal');
      }
      throw error;
    }
  }

  /** A pending withdrawal goes back to the balance. */
  async cancelWithdrawal(playerId: string, id: string): Promise<Payment> {
    return this.db.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      if (row?.playerId !== playerId) throw new NotFoundException('Payment not found');
      if (row.kind !== 'withdrawal' || row.status !== 'pending') {
        throw paymentError('NOT_CANCELLABLE', 'This withdrawal can no longer be cancelled');
      }
      await this.reverse(tx, row);
      return toPayment(await this.finish(tx, row.id, { status: 'cancelled' }));
    });
  }

  async list(
    playerId: string,
    { kind, page, pageSize }: z.output<typeof paymentsQuerySchema>,
  ): Promise<PaymentsPage> {
    await this.expireStaleDeposits();
    const where = and(eq(payments.playerId, playerId), kind ? eq(payments.kind, kind) : undefined);
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(payments)
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(payments).where(where),
    ]);
    return { items: rows.map(toPayment), total: total?.value ?? 0, page, pageSize };
  }

  async get(playerId: string, id: string): Promise<Payment> {
    await this.expireStaleDeposits();
    const [row] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.playerId, playerId)));
    if (!row) throw new NotFoundException('Payment not found');
    return toPayment(row);
  }

  async cards(playerId: string): Promise<SavedCard[]> {
    const rows = await this.db
      .select()
      .from(savedCards)
      .where(eq(savedCards.playerId, playerId))
      .orderBy(desc(savedCards.createdAt));
    return rows.map(toCard);
  }

  // ── Bank callback ──────────────────────────────────────────────────────────────────────────

  /**
   * The bank's verdict on a deposit. Idempotent: a repeated callback with the same outcome is
   * a no-op. A success after we expired the payment is still credited (the card was charged).
   */
  async handleCallback(callback: PaymentCallback): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.lock(tx, callback.paymentId);
      if (row?.kind !== 'deposit') throw new NotFoundException('Unknown payment');
      if (row.amount !== callback.amount) {
        this.logger.error(`Callback amount ${callback.amount} ≠ ${row.amount} for ${row.id}`);
        throw new BadRequestException('Amount mismatch');
      }
      const open = row.status === 'pending' || row.status === 'expired';
      if (!open) {
        if (row.status === callback.status) return;
        this.logger.error(`Callback ${callback.status} for ${row.status} payment ${row.id}`);
        throw new ConflictException('The payment is already final');
      }

      if (callback.status !== 'succeeded') {
        await this.finish(tx, row.id, {
          status: callback.status,
          reason: callback.reason ?? null,
          providerReference: callback.providerReference,
        });
        return;
      }

      let card: SavedCardRow | null = null;
      if (callback.card) {
        await tx
          .insert(savedCards)
          .values({ playerId: row.playerId, provider: row.provider, ...callback.card })
          .onConflictDoNothing();
        [card] = (await tx
          .select()
          .from(savedCards)
          .where(
            and(
              eq(savedCards.playerId, row.playerId),
              eq(savedCards.provider, row.provider),
              eq(savedCards.token, callback.card.token),
            ),
          )) as [SavedCardRow];
      }
      await this.ledger.post(
        {
          idempotencyKey: `payment:${row.id}`,
          type: 'deposit',
          playerId: row.playerId,
          legs: [
            { account: { kind: 'funding' }, amount: -row.amount },
            { account: { kind: 'player', playerId: row.playerId }, amount: row.amount },
          ],
        },
        tx,
      );
      await this.finish(tx, row.id, {
        status: 'succeeded',
        providerReference: callback.providerReference,
        cardId: card?.id ?? null,
        cardMask: card?.mask ?? null,
      });
    });
  }

  // ── Staff ──────────────────────────────────────────────────────────────────────────────────

  async adminList({
    kind,
    status,
    playerId,
    page,
    pageSize,
  }: z.output<typeof adminPaymentsQuerySchema>): Promise<AdminPaymentsPage> {
    await this.expireStaleDeposits();
    const where = and(
      kind ? eq(payments.kind, kind) : undefined,
      status ? eq(payments.status, status) : undefined,
      playerId ? eq(payments.playerId, playerId) : undefined,
    );
    // The withdrawal queue is worked oldest first; everything else newest first.
    const oldestFirst = kind === 'withdrawal' && status === 'pending';
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(payments)
        .where(where)
        .orderBy(oldestFirst ? payments.createdAt : desc(payments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(payments).where(where),
    ]);
    return { items: await this.toAdmin(rows), total: total?.value ?? 0, page, pageSize };
  }

  /**
   * Pays a pending withdrawal out to its card. Paid: `withdrawals` → `funding`. Refused by the
   * bank: the money goes back to the player. No answer: nothing changes (502), try again.
   */
  async approve(actor: string, id: string): Promise<AdminPayment> {
    const row = await this.db.transaction(async (tx) => {
      const payment = await this.pendingWithdrawal(tx, id);
      const [card] = await tx.select().from(savedCards).where(eq(savedCards.id, payment.cardId!));
      let result;
      try {
        result = await this.gateway.payout({
          paymentId: payment.id,
          provider: payment.provider,
          amount: payment.amount,
          cardToken: card!.token,
        });
      } catch (error) {
        if (error instanceof GatewayUnavailableError) {
          throw paymentError('GATEWAY_UNAVAILABLE', 'The bank did not answer. Try again.');
        }
        throw error;
      }
      if (!result.ok) {
        await this.reverse(tx, payment);
        return this.finish(tx, id, { status: 'failed', reason: result.reason, decidedBy: actor });
      }
      await this.ledger.post(
        {
          idempotencyKey: `payment:${id}:payout`,
          type: 'payout',
          playerId: payment.playerId,
          legs: [
            { account: { kind: 'withdrawals' }, amount: -payment.amount },
            { account: { kind: 'funding' }, amount: payment.amount },
          ],
        },
        tx,
      );
      return this.finish(tx, id, {
        status: 'succeeded',
        providerReference: result.providerReference,
        decidedBy: actor,
      });
    });
    await this.audit.record({
      actor,
      action: 'payment.withdrawal_approve',
      entityType: 'payment',
      entityId: id,
      before: { status: 'pending' },
      after: { status: row.status, reason: row.reason },
    });
    return (await this.toAdmin([row]))[0]!;
  }

  /** Refuses a pending withdrawal; the money goes back to the player. The player sees `reason`. */
  async reject(actor: string, id: string, reason: string): Promise<AdminPayment> {
    const row = await this.db.transaction(async (tx) => {
      const payment = await this.pendingWithdrawal(tx, id);
      await this.reverse(tx, payment);
      return this.finish(tx, id, { status: 'rejected', reason, decidedBy: actor });
    });
    await this.audit.record({
      actor,
      action: 'payment.withdrawal_reject',
      entityType: 'payment',
      entityId: id,
      before: { status: 'pending' },
      after: { status: 'rejected', reason },
    });
    return (await this.toAdmin([row]))[0]!;
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────

  private async lock(tx: Tx, id: string): Promise<PaymentRow | null> {
    const [row] = await tx.select().from(payments).where(eq(payments.id, id)).for('update');
    return row ?? null;
  }

  private async pendingWithdrawal(tx: Tx, id: string): Promise<PaymentRow> {
    const row = await this.lock(tx, id);
    if (row?.kind !== 'withdrawal') throw new NotFoundException('Withdrawal not found');
    if (row.status !== 'pending') {
      throw paymentError('NOT_CANCELLABLE', 'This withdrawal is no longer pending');
    }
    return row;
  }

  /** Gives a reserved withdrawal back: `withdrawals` → player. */
  private async reverse(tx: Tx, row: PaymentRow) {
    await this.ledger.post(
      {
        idempotencyKey: `payment:${row.id}:reversal`,
        type: 'withdrawal_reversal',
        playerId: row.playerId,
        legs: [
          { account: { kind: 'withdrawals' }, amount: -row.amount },
          { account: { kind: 'player', playerId: row.playerId }, amount: row.amount },
        ],
      },
      tx,
    );
  }

  private async finish(
    tx: Tx,
    id: string,
    values: Partial<
      Pick<
        PaymentRow,
        'status' | 'reason' | 'providerReference' | 'decidedBy' | 'cardId' | 'cardMask'
      >
    >,
  ): Promise<PaymentRow> {
    const [row] = await tx
      .update(payments)
      .set({ ...values, completedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return row!;
  }

  /** Deposits never completed at the bank. A late success callback still credits them. */
  private async expireStaleDeposits() {
    await this.db
      .update(payments)
      .set({ status: 'expired', completedAt: new Date() })
      .where(
        and(
          eq(payments.kind, 'deposit'),
          eq(payments.status, 'pending'),
          lt(payments.createdAt, new Date(Date.now() - PAYMENT_LIMITS.depositTtlMs)),
        ),
      );
  }

  private async toAdmin(rows: PaymentRow[]): Promise<AdminPayment[]> {
    const [contacts, names] = await Promise.all([
      this.adminPlayers.contacts([...new Set(rows.map((row) => row.playerId))]),
      this.staff.names([...new Set(rows.flatMap((row) => staffId(row.decidedBy) ?? []))]),
    ]);
    return rows.map((row) => {
      const contact = contacts.get(row.playerId);
      return {
        ...toPayment(row),
        playerId: row.playerId,
        playerContact: contact?.email ?? contact?.phone ?? null,
        providerReference: row.providerReference,
        decidedBy: names.get(staffId(row.decidedBy) ?? '') ?? row.decidedBy,
      };
    });
  }
}
