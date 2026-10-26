import { Module } from '@nestjs/common';

import { InMemoryPromotionsRepository } from './in-memory-promotions.repository.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsRepository } from './promotions.repository.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  controllers: [PromotionsController],
  providers: [
    PromotionsService,
    { provide: PromotionsRepository, useClass: InMemoryPromotionsRepository },
  ],
  exports: [PromotionsService],
})
export class PromotionsModule {}
