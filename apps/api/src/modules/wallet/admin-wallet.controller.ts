import { adminListQuerySchema, type WalletTransactionsPage } from '@metrobet/contracts';
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles, StaffAuthGuard } from '../auth/auth.guards.js';
import { WalletService } from './wallet.service.js';

/** Staff view of a player's wallet history (same rows the player sees on /wallet). */
@Controller('admin/players/:playerId/transactions')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminWalletController {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  @Get()
  list(
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
    @Query(new ZodValidationPipe(adminListQuerySchema))
    { page, pageSize }: z.output<typeof adminListQuerySchema>,
  ): Promise<WalletTransactionsPage> {
    return this.wallet.listTransactions(playerId, page, pageSize);
  }
}
