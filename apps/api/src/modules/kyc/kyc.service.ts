import {
  type AdminKycCheck,
  type AdminKycChecksPage,
  type adminKycQuerySchema,
  ageOn,
  type KycCallback,
  type KycDecision,
  type KycOverview,
  type KycPerson,
  type KycRejection,
  type KycStarted,
  MIN_PLAYER_AGE,
} from '@metrobet/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../config/env.js';
import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { StaffDirectory } from '../auth/staff-directory.js';
import { AdminPlayersService } from '../players/admin-players.service.js';
import { PlayersService } from '../players/players.service.js';
import type { Tx } from '../wallet/ledger.js';
import { type KycCheckRow, kycChecks } from './kyc.schema.js';
import { KycProvider } from './provider/kyc-provider.js';

const FINAL = new Set(['approved', 'rejected']);
const staffId = (actor: string | null) => /^staff:(.+)$/.exec(actor ?? '')?.[1];

const personOf = (row: KycCheckRow): KycPerson | null =>
  row.firstName &&
  row.lastName &&
  row.personalNumber &&
  row.dateOfBirth &&
  row.documentType &&
  row.documentNumber
    ? {
        firstName: row.firstName,
        lastName: row.lastName,
        personalNumber: row.personalNumber,
        dateOfBirth: row.dateOfBirth,
        documentType: row.documentType,
        documentNumber: row.documentNumber,
      }
    : null;

/**
 * Identity verification (rules in this module's CLAUDE.md). The provider reads the document;
 * we check it against the account (date of birth, age, one account per personal number).
 */
@Injectable()
export class KycService {
  private readonly webUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(KycProvider) private readonly provider: KycProvider,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(AdminPlayersService) private readonly adminPlayers: AdminPlayersService,
    @Inject(StaffDirectory) private readonly staff: StaffDirectory,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  async overview(playerId: string): Promise<KycOverview> {
    const [account, [latest]] = await Promise.all([
      this.players.account(playerId),
      this.db
        .select()
        .from(kycChecks)
        .where(eq(kycChecks.playerId, playerId))
        .orderBy(desc(kycChecks.createdAt))
        .limit(1),
    ]);
    return {
      status: account.kycStatus,
      firstName: account.firstName,
      lastName: account.lastName,
      verifiedAt: account.kycVerifiedAt?.toISOString() ?? null,
      latest: latest
        ? {
            id: latest.id,
            status: latest.status,
            rejection: latest.rejection,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    };
  }

  /** A new check at the provider. Unfinished older ones are abandoned. */
  async start(playerId: string): Promise<KycStarted> {
    const account = await this.players.account(playerId);
    if (account.kycStatus === 'verified') throw new ConflictException('Already verified');
    const id = await this.db.transaction(async (tx) => {
      const open = await tx
        .select({ id: kycChecks.id, status: kycChecks.status })
        .from(kycChecks)
        .where(
          and(eq(kycChecks.playerId, playerId), inArray(kycChecks.status, ['started', 'review'])),
        )
        .for('update');
      if (open.some((check) => check.status === 'review')) {
        throw new ConflictException('A check is being reviewed');
      }
      if (open.length > 0) {
        await tx
          .update(kycChecks)
          .set({ status: 'abandoned', completedAt: new Date() })
          .where(
            inArray(
              kycChecks.id,
              open.map((check) => check.id),
            ),
          );
      }
      const [row] = await tx
        .insert(kycChecks)
        .values({ playerId, provider: this.provider.name })
        .returning({ id: kycChecks.id });
      return row!.id;
    });
    const { redirectUrl } = await this.provider.startCheck({
      checkId: id,
      returnUrl: `${this.webUrl}/account/identity?check=${id}`,
    });
    return { checkId: id, redirectUrl };
  }

  /**
   * The provider's result. Idempotent: the same outcome again is a no-op; a different outcome
   * for a decided check is 409. An approval still has to pass our own checks.
   */
  async handleCallback(callback: KycCallback): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.lock(tx, callback.checkId);
      if (!row) throw new NotFoundException('Unknown check');
      if (FINAL.has(row.status) || row.status === 'review') {
        if (row.status === callback.outcome) return;
        // A decided check: the provider's late opinion no longer counts.
        if (row.status !== 'review' || callback.outcome === 'review') {
          throw new ConflictException('The check is already decided');
        }
      }
      const base = {
        providerReference: callback.providerReference,
        note: callback.reason ?? null,
        ...callback.person,
      };
      if (callback.outcome === 'rejected' || !callback.person) {
        await this.reject(tx, row, 'document', {
          ...base,
          note: base.note ?? 'Unreadable document',
        });
      } else if (callback.outcome === 'review') {
        await tx
          .update(kycChecks)
          .set({ ...base, status: 'review' })
          .where(eq(kycChecks.id, row.id));
        await this.players.setKyc(row.playerId, { status: 'pending' }, tx);
      } else {
        await this.approveIfValid(tx, row, callback.person, base);
      }
    });
  }

  async adminList({
    status,
    playerId,
    page,
    pageSize,
  }: z.output<typeof adminKycQuerySchema>): Promise<AdminKycChecksPage> {
    const where = and(
      status ? eq(kycChecks.status, status) : undefined,
      playerId ? eq(kycChecks.playerId, playerId) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(kycChecks)
        .where(where)
        // The review queue is worked oldest first.
        .orderBy(status === 'review' ? kycChecks.createdAt : desc(kycChecks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(kycChecks).where(where),
    ]);
    return { items: await this.toAdmin(rows), total: total?.value ?? 0, page, pageSize };
  }

  /** Staff decision on a check in review. An approval still runs our own checks. */
  async decide(actor: string, id: string, decision: KycDecision): Promise<AdminKycCheck> {
    const row = await this.db.transaction(async (tx) => {
      const check = await this.lock(tx, id);
      if (!check) throw new NotFoundException('Check not found');
      if (check.status !== 'review') throw new ConflictException('This check is not in review');
      if (decision.decision === 'reject') {
        return this.reject(tx, check, decision.rejection, {
          note: decision.note,
          reviewedBy: actor,
        });
      }
      const person = personOf(check);
      if (!person) {
        return this.reject(tx, check, 'document', { note: 'Incomplete data', reviewedBy: actor });
      }
      return this.approveIfValid(tx, check, person, { reviewedBy: actor });
    });
    await this.audit.record({
      actor,
      action: `kyc.${decision.decision}`,
      entityType: 'player',
      entityId: row.playerId,
      before: { check: id, status: 'review' },
      after: { check: id, status: row.status, rejection: row.rejection, note: row.note },
    });
    return (await this.toAdmin([row]))[0]!;
  }

  private async lock(tx: Tx, id: string): Promise<KycCheckRow | null> {
    const [row] = await tx.select().from(kycChecks).where(eq(kycChecks.id, id)).for('update');
    return row ?? null;
  }

  /** Our own rules on top of the provider's approval. */
  private async approveIfValid(
    tx: Tx,
    row: KycCheckRow,
    person: KycPerson,
    extra: Partial<KycCheckRow>,
  ): Promise<KycCheckRow> {
    const account = await this.players.account(row.playerId, tx);
    const values = { ...extra, ...person };
    const problem: KycRejection | null =
      person.dateOfBirth !== account.dateOfBirth
        ? 'dob_mismatch'
        : ageOn(person.dateOfBirth) < MIN_PLAYER_AGE
          ? 'underage'
          : (await this.players.personalNumberTaken(row.playerId, person.personalNumber, tx))
            ? 'duplicate'
            : null;
    if (problem) return this.reject(tx, row, problem, values);
    const [updated] = await tx
      .update(kycChecks)
      .set({ ...values, status: 'approved', rejection: null, completedAt: new Date() })
      .where(eq(kycChecks.id, row.id))
      .returning();
    await this.players.setKyc(row.playerId, { status: 'verified', person }, tx);
    return updated!;
  }

  private async reject(
    tx: Tx,
    row: KycCheckRow,
    rejection: KycRejection,
    extra: Partial<KycCheckRow>,
  ): Promise<KycCheckRow> {
    const [updated] = await tx
      .update(kycChecks)
      .set({ ...extra, status: 'rejected', rejection, completedAt: new Date() })
      .where(eq(kycChecks.id, row.id))
      .returning();
    await this.players.setKyc(row.playerId, { status: 'rejected' }, tx);
    return updated!;
  }

  private async toAdmin(rows: KycCheckRow[]): Promise<AdminKycCheck[]> {
    const [contacts, names] = await Promise.all([
      this.adminPlayers.contacts([...new Set(rows.map((row) => row.playerId))]),
      this.staff.names([...new Set(rows.flatMap((row) => staffId(row.reviewedBy) ?? []))]),
    ]);
    return rows.map((row) => {
      const contact = contacts.get(row.playerId);
      const person = {
        firstName: row.firstName ?? undefined,
        lastName: row.lastName ?? undefined,
        personalNumber: row.personalNumber ?? undefined,
        dateOfBirth: row.dateOfBirth ?? undefined,
        documentType: row.documentType ?? undefined,
        documentNumber: row.documentNumber ?? undefined,
      };
      return {
        id: row.id,
        playerId: row.playerId,
        playerContact: contact?.email ?? contact?.phone ?? null,
        registeredDateOfBirth: contact?.dateOfBirth ?? null,
        status: row.status,
        person: Object.values(person).some(Boolean) ? person : null,
        rejection: row.rejection,
        note: row.note,
        providerReference: row.providerReference,
        reviewedBy: names.get(staffId(row.reviewedBy) ?? '') ?? row.reviewedBy,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      };
    });
  }
}
