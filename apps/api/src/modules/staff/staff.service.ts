import type { StaffAuthResponse, StaffProfile, StaffRole } from '@metrobet/contracts';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { isUniqueViolation } from '../../database/errors.js';
import { PasswordHasher } from '../auth/password-hasher.js';
import { type SessionMeta, SessionService } from '../auth/session.service.js';
import { staff, type StaffRow } from './staff.schema.js';

const toProfile = ({ id, email, name, role }: StaffRow): StaffProfile => ({
  id,
  email,
  name,
  role,
});

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string, meta: SessionMeta): Promise<StaffAuthResponse> {
    const [row] = await this.db.select().from(staff).where(eq(staff.email, email));
    const valid = await this.passwords.verify(row?.passwordHash ?? null, password);
    if (!row || !valid || !row.isActive) throw new UnauthorizedException('Wrong email or password');
    await this.db.update(staff).set({ lastLoginAt: new Date() }).where(eq(staff.id, row.id));
    return { session: await this.sessions.create('staff', row.id, meta), staff: toProfile(row) };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  async me(staffId: string): Promise<StaffProfile> {
    const [row] = await this.db.select().from(staff).where(eq(staff.id, staffId));
    if (!row) throw new UnauthorizedException();
    return toProfile(row);
  }

  /** Creates a staff account (CLI, seed, tests; a backoffice screen later). */
  async create(input: {
    email: string;
    name: string;
    role: StaffRole;
    password: string;
  }): Promise<StaffProfile> {
    try {
      const [row] = await this.db
        .insert(staff)
        .values({
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role,
          passwordHash: await this.passwords.hash(input.password),
        })
        .returning();
      return toProfile(row!);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A staff member with this email already exists');
      throw error;
    }
  }
}
