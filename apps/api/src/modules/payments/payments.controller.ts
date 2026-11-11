import {
  type DepositInput,
  depositInputSchema,
  type DepositStarted,
  type Payment,
  type PaymentsPage,
  paymentsQuerySchema,
  type SavedCard,
  type WithdrawalInput,
  withdrawalInputSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { PaymentsService } from './payments.service.js';

/** The player's deposits, withdrawals and saved cards. */
@Controller('payments')
@UseGuards(PlayerAuthGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  list(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query(new ZodValidationPipe(paymentsQuerySchema)) query: z.output<typeof paymentsQuerySchema>,
  ): Promise<PaymentsPage> {
    return this.payments.list(playerId, query);
  }

  @Get('cards')
  cards(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<SavedCard[]> {
    return this.payments.cards(playerId);
  }

  @Get(':id')
  get(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Payment> {
    return this.payments.get(playerId, id);
  }

  /** Returns the bank's card page URL; the browser goes there. */
  @Post('deposits')
  deposit(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(depositInputSchema)) input: DepositInput,
  ): Promise<DepositStarted> {
    return this.payments.startDeposit(playerId, input);
  }

  @Post('withdrawals')
  withdraw(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Body(new ZodValidationPipe(withdrawalInputSchema)) input: WithdrawalInput,
  ): Promise<Payment> {
    return this.payments.requestWithdrawal(playerId, input);
  }

  @Post('withdrawals/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Payment> {
    return this.payments.cancelWithdrawal(playerId, id);
  }
}
