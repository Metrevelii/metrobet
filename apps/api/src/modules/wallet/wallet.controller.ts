import {
  type Wallet,
  type WalletTransactionsPage,
  walletTransactionsQuerySchema,
} from '@metrobet/contracts';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
@UseGuards(PlayerAuthGuard)
export class WalletController {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  @Get()
  get(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<Wallet> {
    return this.wallet.getWallet(playerId);
  }

  @Get('transactions')
  transactions(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query(new ZodValidationPipe(walletTransactionsQuerySchema))
    { page, pageSize }: z.output<typeof walletTransactionsQuerySchema>,
  ): Promise<WalletTransactionsPage> {
    return this.wallet.listTransactions(playerId, page, pageSize);
  }
}
