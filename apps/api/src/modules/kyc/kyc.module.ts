import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PlayersModule } from '../players/players.module.js';
import { AdminKycController } from './admin-kyc.controller.js';
import { KycSignatureGuard } from './kyc-signature.guard.js';
import { KycController } from './kyc.controller.js';
import { KycService } from './kyc.service.js';
import { KycProvider } from './provider/kyc-provider.js';
import { MockKycCallbacks } from './provider/mock/mock-kyc-callbacks.js';
import { MockKycController } from './provider/mock/mock-kyc.controller.js';
import { MockKycProvider } from './provider/mock/mock-kyc-provider.js';

/** Identity verification. `KycProvider` is bound to the mock provider until one is contracted. */
@Module({
  imports: [AuditModule, PlayersModule],
  controllers: [KycController, AdminKycController, MockKycController],
  providers: [
    KycService,
    KycSignatureGuard,
    MockKycCallbacks,
    { provide: KycProvider, useClass: MockKycProvider },
  ],
})
export class KycModule {}
