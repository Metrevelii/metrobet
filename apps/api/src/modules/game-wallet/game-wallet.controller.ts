import {
  type GameWalletResponse,
  gameWalletBalanceRequestSchema,
  gameWalletBetRequestSchema,
  gameWalletRollbackRequestSchema,
  gameWalletWinRequestSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  type PipeTransform,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { GameWalletSignatureGuard } from './game-wallet-signature.guard.js';
import { gameWalletError, GameWalletService } from './game-wallet.service.js';

/** Like ZodValidationPipe, but failures use the protocol's `INVALID_REQUEST` error body. */
class ProtocolBody<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw gameWalletError('INVALID_REQUEST', `${issue?.path.join('.')}: ${issue?.message}`);
    }
    return result.data;
  }
}

/**
 * Server-to-server game wallet API, called by game providers (contracts `game-wallet.ts`).
 * Not for browsers: every call must carry the HMAC signature.
 */
@Controller('game-wallet')
@UseGuards(GameWalletSignatureGuard)
export class GameWalletController {
  constructor(@Inject(GameWalletService) private readonly wallet: GameWalletService) {}

  @Post('balance')
  @HttpCode(200)
  balance(
    @Body(new ProtocolBody(gameWalletBalanceRequestSchema))
    request: z.output<typeof gameWalletBalanceRequestSchema>,
  ): Promise<GameWalletResponse> {
    return this.wallet.balance(request);
  }

  @Post('bet')
  @HttpCode(200)
  bet(
    @Body(new ProtocolBody(gameWalletBetRequestSchema))
    request: z.output<typeof gameWalletBetRequestSchema>,
  ): Promise<GameWalletResponse> {
    return this.wallet.bet(request);
  }

  @Post('win')
  @HttpCode(200)
  win(
    @Body(new ProtocolBody(gameWalletWinRequestSchema))
    request: z.output<typeof gameWalletWinRequestSchema>,
  ): Promise<GameWalletResponse> {
    return this.wallet.win(request);
  }

  @Post('rollback')
  @HttpCode(200)
  rollback(
    @Body(new ProtocolBody(gameWalletRollbackRequestSchema))
    request: z.output<typeof gameWalletRollbackRequestSchema>,
  ): Promise<GameWalletResponse> {
    return this.wallet.rollback(request);
  }
}
