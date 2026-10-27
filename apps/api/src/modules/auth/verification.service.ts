import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { verificationCodes, type VerificationPurpose } from './auth.schema.js';
import { generateCode, sha256 } from './tokens.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Salted with the player id so equal codes don't hash equally. */
const hashCode = (playerId: string, code: string) => sha256(`${playerId}:${code}`);

@Injectable()
export class VerificationService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Issues a fresh code (previous ones stop working). Throws 429 if one was issued less than a
   * minute ago. Returns the plain code for delivery; it is never stored.
   */
  async issue(playerId: string, purpose: VerificationPurpose): Promise<string> {
    const [latest] = await this.db
      .select({ createdAt: verificationCodes.createdAt })
      .from(verificationCodes)
      .where(and(eq(verificationCodes.playerId, playerId), eq(verificationCodes.purpose, purpose)))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait a minute before requesting a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateCode();
    await this.db.transaction(async (tx) => {
      await tx
        .update(verificationCodes)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(verificationCodes.playerId, playerId),
            eq(verificationCodes.purpose, purpose),
            isNull(verificationCodes.consumedAt),
          ),
        );
      await tx.insert(verificationCodes).values({
        playerId,
        purpose,
        codeHash: hashCode(playerId, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
    });
    return code;
  }

  /** Consumes the active code if it matches. Each wrong guess counts; 5 wrong guesses burn it. */
  async consume(playerId: string, purpose: VerificationPurpose, code: string): Promise<boolean> {
    const [active] = await this.db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.playerId, playerId),
          eq(verificationCodes.purpose, purpose),
          isNull(verificationCodes.consumedAt),
        ),
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);
    if (!active || active.expiresAt.getTime() < Date.now() || active.attempts >= MAX_ATTEMPTS)
      return false;

    if (active.codeHash !== hashCode(playerId, code)) {
      await this.db
        .update(verificationCodes)
        .set({ attempts: active.attempts + 1 })
        .where(eq(verificationCodes.id, active.id));
      return false;
    }
    await this.db
      .update(verificationCodes)
      .set({ consumedAt: new Date() })
      .where(eq(verificationCodes.id, active.id));
    return true;
  }
}
