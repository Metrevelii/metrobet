import { type DevDepositInput, devDepositInputSchema, type Wallet } from '@metrobet/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import {
  LimitExceededError,
  ResponsibleGamingService,
} from '../responsible-gaming/responsible-gaming.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const idempotencyKeySchema = z.string().trim().min(1).max(100).optional();

/**
 * Development only (404 in production): test money until real payments exist. Deposit limits
 * apply exactly as they will to real deposits (403 `LIMIT_EXCEEDED`, contracts `limitErrorSchema`).
 */
@Controller('dev/wallet')
export class DevDepositController {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(ResponsibleGamingService) private readonly rg: ResponsibleGamingService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('deposit')
  @HttpCode(200)
  @UseGuards(PlayerAuthGuard)
  async deposit(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(devDepositInputSchema)) { amount }: DevDepositInput,
    @Headers('idempotency-key') header?: string,
  ): Promise<Wallet> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new NotFoundException();
    }
    const key = idempotencyKeySchema.safeParse(header);
    if (!key.success) throw new BadRequestException('Invalid Idempotency-Key header');
    try {
      await this.rg.assertCanDeposit(playerId, amount);
    } catch (error) {
      if (!(error instanceof LimitExceededError)) throw error;
      throw new HttpException(
        { code: 'LIMIT_EXCEEDED', message: error.message, limit: error.limit },
        HttpStatus.FORBIDDEN,
      );
    }
    return this.wallet.deposit(playerId, amount, `dev:${key.data ?? randomUUID()}`);
  }
}
