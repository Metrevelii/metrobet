import { type DevDepositInput, devDepositInputSchema, type Wallet } from '@metrobet/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
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
import { WalletService } from './wallet.service.js';

const idempotencyKeySchema = z.string().trim().min(1).max(100).optional();

/** Development only (404 in production): test money until real payments exist. */
@Controller('dev/wallet')
export class DevWalletController {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('deposit')
  @HttpCode(200)
  @UseGuards(PlayerAuthGuard)
  deposit(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(devDepositInputSchema)) { amount }: DevDepositInput,
    @Headers('idempotency-key') header?: string,
  ): Promise<Wallet> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new NotFoundException();
    }
    const key = idempotencyKeySchema.safeParse(header);
    if (!key.success) throw new BadRequestException('Invalid Idempotency-Key header');
    return this.wallet.deposit(playerId, amount, `dev:${key.data ?? randomUUID()}`);
  }
}
