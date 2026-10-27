import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CasinoModule } from '../casino/casino.module.js';
import { WebModule } from '../web/web.module.js';
import { AdminPromotionsController } from './admin-promotions.controller.js';
import { AdminPromotionsService } from './admin-promotions.service.js';
import { DrizzlePromotionsRepository } from './drizzle-promotions.repository.js';
import { PromoActivityService } from './engine/promo-activity.service.js';
import { PromoEligibility } from './engine/promo-eligibility.js';
import { PROMO_MECHANICS } from './engine/promo-mechanic.js';
import { WheelController } from './mechanics/wheel/wheel.controller.js';
import { WheelMechanic } from './mechanics/wheel/wheel.mechanic.js';
import { WheelService } from './mechanics/wheel/wheel.service.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsRepository } from './promotions.repository.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [ActivityModule, AuditModule, CasinoModule, WebModule],
  controllers: [PromotionsController, AdminPromotionsController, WheelController],
  providers: [
    PromotionsService,
    AdminPromotionsService,
    { provide: PromotionsRepository, useClass: DrizzlePromotionsRepository },
    PromoEligibility,
    PromoActivityService,
    // Mechanic plugins: add new ones here.
    WheelMechanic,
    WheelService,
    { provide: PROMO_MECHANICS, inject: [WheelMechanic], useFactory: (...all) => all },
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
