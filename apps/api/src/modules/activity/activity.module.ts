import { Module } from '@nestjs/common';

import { CasinoModule } from '../casino/casino.module.js';
import { ActivityBus } from './activity-bus.js';
import { DevActivityController } from './dev-activity.controller.js';

@Module({
  imports: [CasinoModule],
  controllers: [DevActivityController],
  providers: [ActivityBus],
  exports: [ActivityBus],
})
export class ActivityModule {}
