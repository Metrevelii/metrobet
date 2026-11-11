import { Module } from '@nestjs/common';

import { ResponsibleGamingModule } from '../responsible-gaming/responsible-gaming.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { DevDepositController } from './dev-deposit.controller.js';

/**
 * Money in and out of the platform. For now only the dev deposit; TBC / BoG deposits and
 * withdrawals go here, each checking deposit limits before `WalletService` posts the money.
 */
@Module({
  imports: [ResponsibleGamingModule, WalletModule],
  controllers: [DevDepositController],
})
export class PaymentsModule {}
