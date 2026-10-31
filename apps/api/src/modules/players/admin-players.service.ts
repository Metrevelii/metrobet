import {
  type AdminPlayer,
  type AdminPlayersPage,
  type adminPlayersQuerySchema,
  type PlayerStatusUpdate,
} from '@metrobet/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { type PlayerRow, players } from './players.schema.js';

type PlayersQuery = z.output<typeof adminPlayersQuerySchema>;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Staff operations on player accounts. Every change is audit-logged. */
@Injectable()
export class AdminPlayersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Newest first. `search` matches email, phone digits or the id. */
  async list({ search, status, page, pageSize }: PlayersQuery): Promise<AdminPlayersPage> {
    const term = search ? `%${escapeLike(search)}%` : null;
    const digits = search?.replace(/\D/g, '');
    const where = and(
      status ? eq(players.status, status) : undefined,
      term
        ? or(
            ilike(players.email, term),
            digits ? ilike(players.phone, `%${digits}%`) : undefined,
            sql`${players.id}::text ilike ${term}`,
          )
        : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(players)
        .where(where)
        .orderBy(desc(players.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(players).where(where),
    ]);
    const balances = await this.wallet.balances(rows.map((row) => row.id));
    return {
      items: rows.map((row) => this.toAdmin(row, balances.get(row.id) ?? 0)),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<AdminPlayer> {
    const row = await this.find(id);
    return this.toAdmin(row, (await this.wallet.getWallet(id)).balance);
  }

  /** Suspending or self-excluding signs the player out everywhere at once. */
  async setStatus(actor: string, id: string, { status, reason }: PlayerStatusUpdate) {
    const before = await this.find(id);
    const [after] = await this.db
      .update(players)
      .set({ status })
      .where(eq(players.id, id))
      .returning();
    if (status !== 'active') await this.sessions.revokeAll('player', id);
    await this.audit.record({
      actor,
      action: 'player.status',
      entityType: 'player',
      entityId: id,
      before: { status: before.status },
      after: { status, reason },
    });
    return this.toAdmin(after!, (await this.wallet.getWallet(id)).balance);
  }

  /** New accounts since a moment (dashboard). */
  async countSince(since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(players)
      .where(gte(players.createdAt, since));
    return row?.value ?? 0;
  }

  /** Contact details of players, for staff lists of tickets and the like. */
  async contacts(ids: string[]) {
    if (ids.length === 0) return new Map<string, Pick<PlayerRow, 'id' | 'email' | 'phone'>>();
    const rows = await this.db
      .select({ id: players.id, email: players.email, phone: players.phone })
      .from(players)
      .where(inArray(players.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async find(id: string): Promise<PlayerRow> {
    const [row] = await this.db.select().from(players).where(eq(players.id, id));
    if (!row) throw new NotFoundException('Player not found');
    return row;
  }

  private toAdmin(row: PlayerRow, balance: number): AdminPlayer {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      status: row.status,
      kycStatus: row.kycStatus,
      verified: row.verifiedAt !== null,
      dateOfBirth: row.dateOfBirth,
      locale: row.locale,
      balance,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    };
  }
}
