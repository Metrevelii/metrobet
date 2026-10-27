import { Injectable, Logger } from '@nestjs/common';

import { type Notification, Notifier, renderNotification } from './notifier.js';

export type OutboxMessage = Notification & { text: string; sentAt: string };

const OUTBOX_SIZE = 50;

/** Development adapter: messages go to the API log and an in-memory outbox (`GET /api/dev/outbox`). */
@Injectable()
export class DevNotifier extends Notifier {
  private readonly logger = new Logger('DevNotifier');
  readonly outbox: OutboxMessage[] = [];

  send(notification: Notification) {
    const text = renderNotification(notification);
    this.outbox.unshift({ ...notification, text, sentAt: new Date().toISOString() });
    this.outbox.length = Math.min(this.outbox.length, OUTBOX_SIZE);
    this.logger.log(`[${notification.channel} → ${notification.to}] ${text}`);
    return Promise.resolve();
  }
}
