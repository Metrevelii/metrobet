import { Global, Module } from '@nestjs/common';

import { DevNotifier } from './dev-notifier.js';
import { DevOutboxController } from './dev-outbox.controller.js';
import { Notifier } from './notifier.js';

@Global()
@Module({
  controllers: [DevOutboxController],
  // Bind real email/SMS adapters here for production.
  providers: [{ provide: Notifier, useClass: DevNotifier }],
  exports: [Notifier],
})
export class NotificationsModule {}
