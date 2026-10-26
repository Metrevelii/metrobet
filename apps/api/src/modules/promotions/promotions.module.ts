import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { WebModule } from '../web/web.module.js';
import { AdminPromotionsController } from './admin-promotions.controller.js';
import { AdminPromotionsService } from './admin-promotions.service.js';
import { DrizzlePromotionsRepository } from './drizzle-promotions.repository.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsRepository } from './promotions.repository.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [AuditModule, WebModule],
  controllers: [PromotionsController, AdminPromotionsController],
  providers: [
    PromotionsService,
    AdminPromotionsService,
    { provide: PromotionsRepository, useClass: DrizzlePromotionsRepository },
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
