import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PlayersModule } from '../players/players.module.js';
import { ResponsibleGamingModule } from '../responsible-gaming/responsible-gaming.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { DevDepositController } from './dev-deposit.controller.js';
import { MockBankCallbacks } from './gateway/mock/mock-bank-callbacks.js';
import { MockBankController } from './gateway/mock/mock-bank.controller.js';
import { MockPaymentGateway } from './gateway/mock/mock-payment-gateway.js';
import { PaymentGateway } from './gateway/payment-gateway.js';
import { PaymentCallbackController } from './payment-callback.controller.js';
import { PaymentSignatureGuard } from './payment-signature.guard.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

/**
 * Money in and out: deposits through a bank's card page, withdrawals approved by finance.
 * `PaymentGateway` is bound to the mock bank (TBC / BoG stand-in) until real contracts exist.
 */
@Module({
  imports: [AuditModule, PlayersModule, ResponsibleGamingModule, WalletModule],
  controllers: [
    PaymentsController,
    PaymentCallbackController,
    AdminPaymentsController,
    DevDepositController,
    MockBankController,
  ],
  providers: [
    PaymentsService,
    PaymentSignatureGuard,
    MockBankCallbacks,
    { provide: PaymentGateway, useClass: MockPaymentGateway },
  ],
})
export class PaymentsModule {}
