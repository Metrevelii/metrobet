import { Module } from '@nestjs/common';

import { DevWalletController } from './dev-wallet.controller.js';
import { Ledger } from './ledger.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

@Module({
  controllers: [WalletController, DevWalletController],
  providers: [Ledger, WalletService],
  exports: [Ledger, WalletService],
})
export class WalletModule {}
