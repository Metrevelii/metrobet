import { Inject, Injectable } from '@nestjs/common';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { auditLog } from './audit.schema.js';

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
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record({ before = null, after = null, ...entry }: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({ ...entry, before, after });
  }
}
