import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { staff } from '../staff/staff.schema.js';

/** Read-only staff lookup for the guard (keeps auth free of a dependency on the staff module). */
@Injectable()
export class StaffDirectory {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActive(id: string) {
    const [member] = await this.db
      .select({ id: staff.id, email: staff.email, role: staff.role })
      .from(staff)
      .where(and(eq(staff.id, id), eq(staff.isActive, true)));
    return member ?? null;
  }
}
