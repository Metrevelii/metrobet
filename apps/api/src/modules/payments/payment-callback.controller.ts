import { type PaymentCallback, paymentCallbackSchema } from '@metrobet/contracts';
import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PaymentSignatureGuard } from './payment-signature.guard.js';
import { PaymentsService } from './payments.service.js';

/** Server to server: the bank reports a deposit's outcome. Signed; safe to repeat. */
@Controller('payments/callback')
@UseGuards(PaymentSignatureGuard)
export class PaymentCallbackController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post()
  @HttpCode(200)
  async callback(
    @Body(new ZodValidationPipe(paymentCallbackSchema)) callback: PaymentCallback,
  ): Promise<{ ok: true }> {
    await this.payments.handleCallback(callback);
    return { ok: true };
  }
}
