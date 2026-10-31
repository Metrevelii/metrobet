import { type AuditPage, type auditQuerySchema } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { StaffDirectory } from '../auth/staff-directory.js';
import { auditLog } from './audit.schema.js';

const STAFF_ACTOR = /^staff:(.+)$/;

export type AuditEntry = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

@Injectable()
export class AuditService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(StaffDirectory) private readonly staff: StaffDirectory,
  ) {}

  async record({ before = null, after = null, ...entry }: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({ ...entry, before, after });
  }

  /** Newest first, optionally for one entity type / entity. Staff actors get their name. */
  async list({
    entityType,
    entityId,
    page,
    pageSize,
  }: z.output<typeof auditQuerySchema>): Promise<AuditPage> {
    const where = and(
      entityType ? eq(auditLog.entityType, entityType) : undefined,
      entityId ? eq(auditLog.entityId, entityId) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(auditLog).where(where),
    ]);
    const names = await this.staff.names([
      ...new Set(rows.flatMap((row) => STAFF_ACTOR.exec(row.actor)?.[1] ?? [])),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        actorName: names.get(STAFF_ACTOR.exec(row.actor)?.[1] ?? '') ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  }
}
