import {
  type confirmVerificationInputSchema,
  type forgotPasswordInputSchema,
  type Identifier,
  type Locale,
  type loginInputSchema,
  type PlayerAuthResponse,
  type PlayerProfile,
  type registerInputSchema,
  type resetPasswordInputSchema,
} from '@metrobet/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { isUniqueViolation } from '../../database/errors.js';
import { PasswordHasher } from '../auth/password-hasher.js';
import { type SessionMeta, SessionService } from '../auth/session.service.js';
import { VerificationService } from '../auth/verification.service.js';
import { Notifier } from '../notifications/notifier.js';
import { type PlayerRow, players } from './players.schema.js';

const INVALID_CREDENTIALS = 'Wrong email/phone or password';
const INVALID_CODE = 'The code is wrong or has expired';

export function toProfile(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    verified: row.verifiedAt !== null,
    dateOfBirth: row.dateOfBirth,
    status: row.status,
    kycStatus: row.kycStatus,
    currency: 'GEL',
    createdAt: row.createdAt.toISOString(),
  };
}

const contactColumn = (identifier: Identifier) =>
  identifier.type === 'email' ? players.email : players.phone;

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(VerificationService) private readonly verification: VerificationService,
    @Inject(Notifier) private readonly notifier: Notifier,
  ) {}

  async register(
    input: z.output<typeof registerInputSchema>,
    meta: SessionMeta,
  ): Promise<PlayerAuthResponse> {
    const { identifier } = input;
    let row: PlayerRow;
    try {
      [row] = (await this.db
        .insert(players)
        .values({
          [identifier.type]: identifier.value,
          passwordHash: await this.passwords.hash(input.password),
          dateOfBirth: input.dateOfBirth,
          locale: input.locale,
          termsAcceptedAt: new Date(),
        })
        .returning()) as [PlayerRow];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `An account with this ${identifier.type === 'email' ? 'email' : 'phone number'} already exists`,
        );
      }
      throw error;
    }

    const session = await this.sessions.create('player', row.id, meta);
    await this.sendCode(row, 'verify_contact').catch((error: unknown) =>
      this.logger.warn(`Verification code for ${row.id} not sent: ${String(error)}`),
    );
    return { session, player: toProfile(row) };
  }

  async login(
    { identifier, password }: z.output<typeof loginInputSchema>,
    meta: SessionMeta,
  ): Promise<PlayerAuthResponse> {
    const row = await this.findByIdentifier(identifier);
    if (!(await this.passwords.verify(row?.passwordHash ?? null, password)) || !row) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (row.status === 'suspended')
      throw new ForbiddenException('This account is suspended. Please contact support.');
    if (row.status === 'self_excluded')
      throw new ForbiddenException('This account is self-excluded.');

    await this.db.update(players).set({ lastLoginAt: new Date() }).where(eq(players.id, row.id));
    return { session: await this.sessions.create('player', row.id, meta), player: toProfile(row) };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  async me(playerId: string): Promise<PlayerProfile> {
    return toProfile(await this.get(playerId));
  }

  async sendVerification(playerId: string): Promise<void> {
    const row = await this.get(playerId);
    if (row.verifiedAt) throw new BadRequestException('Already verified');
    await this.sendCode(row, 'verify_contact');
  }

  async confirmVerification(
    playerId: string,
    { code }: z.output<typeof confirmVerificationInputSchema>,
  ): Promise<PlayerProfile> {
    if (!(await this.verification.consume(playerId, 'verify_contact', code)))
      throw new BadRequestException(INVALID_CODE);
    const [row] = await this.db
      .update(players)
      .set({ verifiedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();
    return toProfile(row!);
  }

  /** Always succeeds, so the response never reveals whether an account exists. */
  async forgotPassword({
    identifier,
    locale,
  }: z.output<typeof forgotPasswordInputSchema>): Promise<void> {
    const row = await this.findByIdentifier(identifier);
    if (!row) return;
    await this.sendCode({ ...row, locale }, 'reset_password').catch((error: unknown) => {
      if (!(error instanceof HttpException)) throw error;
    });
  }

  async resetPassword({
    identifier,
    code,
    password,
  }: z.output<typeof resetPasswordInputSchema>): Promise<void> {
    const row = await this.findByIdentifier(identifier);
    if (!row || !(await this.verification.consume(row.id, 'reset_password', code))) {
      throw new BadRequestException(INVALID_CODE);
    }
    await this.db
      .update(players)
      .set({
        passwordHash: await this.passwords.hash(password),
        verifiedAt: row.verifiedAt ?? new Date(),
      })
      .where(eq(players.id, row.id));
    await this.sessions.revokeAll('player', row.id);
  }

  private async sendCode(
    row: Pick<PlayerRow, 'id' | 'email' | 'phone' | 'locale'>,
    purpose: 'verify_contact' | 'reset_password',
  ) {
    const code = await this.verification.issue(row.id, purpose);
    await this.notifier.send({
      channel: row.email ? 'email' : 'sms',
      to: (row.email ?? row.phone)!,
      template: purpose,
      locale: row.locale as Locale,
      params: { code },
    });
  }

  private async findByIdentifier(identifier: Identifier): Promise<PlayerRow | null> {
    const [row] = await this.db
      .select()
      .from(players)
      .where(eq(contactColumn(identifier), identifier.value));
    return row ?? null;
  }

  private async get(playerId: string): Promise<PlayerRow> {
    const [row] = await this.db.select().from(players).where(eq(players.id, playerId));
    if (!row) throw new UnauthorizedException('Account not found');
    return row;
  }
}
