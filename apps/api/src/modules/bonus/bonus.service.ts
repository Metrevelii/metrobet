import {
  type ActivityEvent,
  type AdminBonus,
  BONUS_SPORTS_MIN_ODDS,
  type Bonus,
  type Locale,
  type LocalizedText,
  localize,
  type PlayerBonuses,
} from '@metrobet/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, lte, sql } from 'drizzle-orm';

import type { Env } from '../../config/env.js';
import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { ActivityBus } from '../activity/activity-bus.js';
import { AuditService } from '../audit/audit.service.js';
import { Ledger, type Tx } from '../wallet/ledger.js';
import { WalletService } from '../wallet/wallet.service.js';
import { type BonusRow, bonuses } from './bonus.schema.js';

const DAY = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60_000;

export type GrantBonus = {
  playerId: string;
  amount: number;
  wageringMultiplier: number;
  validDays: number;
  /** Idempotency: the same key never grants twice. */
  grantKey: string;
  promotionId?: string | null;
  title?: LocalizedText | null;
};

type EndStatus = 'forfeited' | 'expired' | 'cancelled';

/**
 * Bonus money (rules in this module's CLAUDE.md): grants, wagering progress from the activity
 * bus, conversion to cash, forfeits, expiry. Money moves only through `Ledger.post`, between
 * `marketing`, the player's `bonus` account and their cash.
 */
@Injectable()
export class BonusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BonusService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(Ledger) private readonly ledger: Ledger,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(ActivityBus) private readonly bus: ActivityBus,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    this.bus.subscribe((event) => this.onActivity(event));
    if (this.config.get('BONUS_SWEEP', { infer: true }) === 'on') {
      this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /**
   * Grants bonus money. Idempotent by `grantKey`; null when the player already has an active
   * bonus (one at a time) or the amount is 0.
   */
  async grant(input: GrantBonus): Promise<BonusRow | null> {
    const [existing] = await this.db
      .select()
      .from(bonuses)
      .where(eq(bonuses.grantKey, input.grantKey));
    if (existing) return existing;
    if (input.amount <= 0 || (await this.activeRow(input.playerId))) return null;
    await this.settleStray(input.playerId);
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(bonuses)
          .values({
            playerId: input.playerId,
            amount: input.amount,
            wageringRequired: input.amount * input.wageringMultiplier,
            expiresAt: new Date(Date.now() + input.validDays * DAY),
            grantKey: input.grantKey,
            promotionId: input.promotionId ?? null,
            title: input.title ?? null,
          })
          .returning();
        await this.ledger.post(
          {
            idempotencyKey: `bonus:${row!.id}:grant`,
            type: 'bonus_grant',
            playerId: input.playerId,
            legs: [
              { account: { kind: 'marketing' }, amount: -input.amount },
              { account: { kind: 'bonus', playerId: input.playerId }, amount: input.amount },
            ],
          },
          tx,
        );
        return row!;
      });
    } catch (error) {
      // Lost a race with another grant (same key, or another bonus became active).
      const [raced] = await this.db
        .select()
        .from(bonuses)
        .where(eq(bonuses.grantKey, input.grantKey));
      if (raced) return raced;
      if (await this.activeRow(input.playerId)) return null;
      throw error;
    }
  }

  /** Real bets count towards wagering: casino always, sports tickets at odds ≥ 1.50. */
  async onActivity(event: ActivityEvent): Promise<void> {
    if (event.kind === 'payment.deposit') return;
    if (event.kind === 'sports.bet' && event.odds < BONUS_SPORTS_MIN_ODDS) return;
    const active = await this.current(event.playerId);
    if (!active) return;
    const [updated] = await this.db
      .update(bonuses)
      .set({ wagered: sql`${bonuses.wagered} + ${event.amount}` })
      .where(and(eq(bonuses.id, active.id), eq(bonuses.status, 'active')))
      .returning();
    if (updated && updated.wagered >= updated.wageringRequired) await this.complete(updated.id);
  }

  /** The player's active bonus and history (newest first), titles in `locale`. */
  async overview(playerId: string, locale: Locale): Promise<PlayerBonuses> {
    await this.current(playerId);
    await this.settleStray(playerId);
    const rows = await this.db
      .select()
      .from(bonuses)
      .where(eq(bonuses.playerId, playerId))
      .orderBy(desc(bonuses.createdAt))
      .limit(20);
    const balance = await this.ledger.bonusBalance(playerId);
    const items = rows.map((row) =>
      this.toBonus(row, row.status === 'active' ? balance : 0, locale),
    );
    return {
      active: items.find((item) => item.status === 'active') ?? null,
      history: items.filter((item) => item.status !== 'active'),
    };
  }

  /** The active bonus (after applying a due expiry), or null. */
  async current(playerId: string): Promise<BonusRow | null> {
    const row = await this.activeRow(playerId);
    if (row && row.expiresAt.getTime() <= Date.now()) {
      await this.end(row.id, 'expired', null);
      return null;
    }
    return row;
  }

  /** A withdrawal gives up the active bonus (the player confirmed it). */
  async forfeitForWithdrawal(playerId: string): Promise<void> {
    const row = await this.current(playerId);
    if (row) await this.end(row.id, 'forfeited', 'Withdrawal requested');
  }

  async adminList(playerId: string): Promise<AdminBonus[]> {
    await this.current(playerId);
    const [rows, balance] = await Promise.all([
      this.db
        .select()
        .from(bonuses)
        .where(eq(bonuses.playerId, playerId))
        .orderBy(desc(bonuses.createdAt)),
      this.ledger.bonusBalance(playerId),
    ]);
    return rows.map((row) => ({
      ...this.toBonus(row, row.status === 'active' ? balance : 0, 'en'),
      playerId: row.playerId,
    }));
  }

  /** Staff cancel an active bonus; its money goes back. Audit-logged. */
  async cancel(actor: string, id: string, reason: string): Promise<AdminBonus> {
    const row = await this.end(id, 'cancelled', reason, actor);
    if (!row) throw new ConflictException('Only an active bonus can be cancelled');
    await this.audit.record({
      actor,
      action: 'bonus.cancel',
      entityType: 'player',
      entityId: row.playerId,
      before: { bonus: id, status: 'active' },
      after: { bonus: id, status: 'cancelled', forfeited: row.forfeited, reason },
    });
    return { ...this.toBonus(row, 0, 'en'), playerId: row.playerId };
  }

  /** Expires due bonuses and settles stray bonus money (runs every minute; e2e calls it). */
  async sweep(): Promise<void> {
    try {
      const due = await this.db
        .select({ id: bonuses.id })
        .from(bonuses)
        .where(and(eq(bonuses.status, 'active'), lte(bonuses.expiresAt, new Date())));
      for (const { id } of due) await this.end(id, 'expired', null);
      for (const playerId of await this.wallet.bonusHolders()) await this.settleStray(playerId);
    } catch (error) {
      this.logger.error('Bonus sweep failed', error);
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────

  private async activeRow(playerId: string): Promise<BonusRow | null> {
    const [row] = await this.db
      .select()
      .from(bonuses)
      .where(and(eq(bonuses.playerId, playerId), eq(bonuses.status, 'active')));
    return row ?? null;
  }

  private async lock(tx: Tx, id: string): Promise<BonusRow | null> {
    const [row] = await tx.select().from(bonuses).where(eq(bonuses.id, id)).for('update');
    return row ?? null;
  }

  /** Wagering done: all bonus money becomes cash. */
  private async complete(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      if (row?.status !== 'active') return;
      const balance = await this.ledger.bonusBalance(row.playerId, tx);
      if (balance > 0) {
        await this.ledger.post(
          {
            idempotencyKey: `bonus:${id}:convert`,
            type: 'bonus_convert',
            playerId: row.playerId,
            legs: [
              { account: { kind: 'bonus', playerId: row.playerId }, amount: -balance },
              { account: { kind: 'player', playerId: row.playerId }, amount: balance },
            ],
          },
          tx,
        );
      }
      await tx
        .update(bonuses)
        .set({ status: 'completed', converted: balance, completedAt: new Date() })
        .where(eq(bonuses.id, id));
    });
  }

  /** Ends an active bonus early; its money goes back to `marketing`. Null when not active. */
  private async end(
    id: string,
    status: EndStatus,
    reason: string | null,
    actor?: string,
  ): Promise<BonusRow | null> {
    return this.db.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      if (!row) throw new NotFoundException('Bonus not found');
      if (row.status !== 'active') return null;
      const balance = await this.ledger.bonusBalance(row.playerId, tx);
      if (balance > 0) {
        await this.ledger.post(
          {
            idempotencyKey: `bonus:${id}:end`,
            type: 'bonus_forfeit',
            playerId: row.playerId,
            legs: [
              { account: { kind: 'bonus', playerId: row.playerId }, amount: -balance },
              { account: { kind: 'marketing' }, amount: balance },
            ],
          },
          tx,
        );
      }
      const [updated] = await tx
        .update(bonuses)
        .set({
          status,
          forfeited: balance,
          reason,
          endedBy: actor ?? null,
          completedAt: new Date(),
        })
        .where(eq(bonuses.id, id))
        .returning();
      return updated!;
    });
  }

  /**
   * Bonus money that arrives after its bonus ended (a sports ticket or game round settled
   * later): it follows the bonus's fate. Completed → cash; ended early → back to `marketing`.
   */
  private async settleStray(playerId: string): Promise<void> {
    if (await this.activeRow(playerId)) return;
    await this.db.transaction(async (tx) => {
      const balance = await this.ledger.bonusBalance(playerId, tx);
      if (balance <= 0) return;
      const [last] = await tx
        .select()
        .from(bonuses)
        .where(eq(bonuses.playerId, playerId))
        .orderBy(desc(bonuses.createdAt))
        .limit(1);
      const toCash = last?.status === 'completed';
      // Unique per sweep: the bonus account can't go negative, so a concurrent sweep just fails.
      await this.ledger.post(
        {
          idempotencyKey: `bonus:stray:${playerId}:${Date.now()}:${balance}`,
          type: toCash ? 'bonus_convert' : 'bonus_forfeit',
          playerId,
          legs: [
            { account: { kind: 'bonus', playerId }, amount: -balance },
            toCash
              ? { account: { kind: 'player', playerId }, amount: balance }
              : { account: { kind: 'marketing' }, amount: balance },
          ],
        },
        tx,
      );
      if (last) {
        await tx
          .update(bonuses)
          .set(
            toCash
              ? { converted: sql`${bonuses.converted} + ${balance}` }
              : { forfeited: sql`${bonuses.forfeited} + ${balance}` },
          )
          .where(eq(bonuses.id, last.id));
      }
    });
  }

  private toBonus(row: BonusRow, balance: number, locale: Locale): Bonus {
    return {
      id: row.id,
      status: row.status,
      amount: row.amount,
      balance,
      wageringRequired: row.wageringRequired,
      wagered: Math.min(row.wagered, row.wageringRequired),
      expiresAt: row.expiresAt.toISOString(),
      title: row.title ? localize(row.title, locale) : null,
      reason: row.reason,
      converted: row.converted,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
