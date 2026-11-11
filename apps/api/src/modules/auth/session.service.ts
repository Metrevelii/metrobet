import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { sessions, type SessionSubject } from './auth.schema.js';
import { generateToken, sha256 } from './tokens.js';

const HOUR = 60 * 60 * 1000;
/** Absolute lifetime per subject: players stay signed in for a month, staff for a working day. */
const TTL: Record<SessionSubject, number> = { player: 30 * 24 * HOUR, staff: 12 * HOUR };
/** `lastUsedAt` is written at most this often, to avoid a DB write per request. */
const TOUCH_INTERVAL = 5 * 60 * 1000;

export type SessionMeta = { ip?: string | null; userAgent?: string | null };
export type IssuedSession = { token: string; expiresAt: string };
export type ResolvedSession = { sessionId: string; subjectId: string };

@Injectable()
export class SessionService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(
    subjectType: SessionSubject,
    subjectId: string,
    meta: SessionMeta = {},
  ): Promise<IssuedSession> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TTL[subjectType]);
    await this.db.insert(sessions).values({
      tokenHash: sha256(token),
      subjectType,
      subjectId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** The live session for a bearer token of the given subject type, or null. */
  async resolve(token: string, subjectType: SessionSubject): Promise<ResolvedSession | null> {
    const now = new Date();
    const [session] = await this.db
      .select({ id: sessions.id, subjectId: sessions.subjectId, lastUsedAt: sessions.lastUsedAt })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, sha256(token)),
          eq(sessions.subjectType, subjectType),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      );
    if (!session) return null;
    if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_INTERVAL) {
      await this.db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, session.id));
    }
    return { sessionId: session.id, subjectId: session.subjectId };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  /** Live sessions of a subject, most recently used first. */
  list(subjectType: SessionSubject, subjectId: string) {
    return this.db
      .select({
        id: sessions.id,
        ip: sessions.ip,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastUsedAt: sessions.lastUsedAt,
      })
      .from(sessions)
      .where(this.live(subjectType, subjectId))
      .orderBy(desc(sessions.lastUsedAt));
  }

  /** Revokes one of the subject's own sessions; false when it isn't theirs or already ended. */
  async revokeOwn(subjectType: SessionSubject, subjectId: string, sessionId: string) {
    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(this.live(subjectType, subjectId), eq(sessions.id, sessionId)))
      .returning({ id: sessions.id });
    return revoked.length > 0;
  }

  /** Signs the subject out everywhere except `keepSessionId` (e.g. after a password change). */
  async revokeOthers(subjectType: SessionSubject, subjectId: string, keepSessionId: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(this.live(subjectType, subjectId), ne(sessions.id, keepSessionId)));
  }

  private live(subjectType: SessionSubject, subjectId: string) {
    return and(
      eq(sessions.subjectType, subjectType),
      eq(sessions.subjectId, subjectId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    );
  }

  /** Signs a subject out everywhere (e.g. after a password reset). */
  async revokeAll(subjectType: SessionSubject, subjectId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.subjectType, subjectType),
          eq(sessions.subjectId, subjectId),
          isNull(sessions.revokedAt),
        ),
      );
  }
}
