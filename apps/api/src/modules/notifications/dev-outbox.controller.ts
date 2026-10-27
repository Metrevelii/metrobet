import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { DevNotifier, type OutboxMessage } from './dev-notifier.js';
import { Notifier } from './notifier.js';

/** Development only: read codes that would have been emailed / texted. 404 in production. */
@Controller('dev/outbox')
export class DevOutboxController {
  constructor(
    @Inject(Notifier) private readonly notifier: Notifier,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  list(@Query('to') to?: string): OutboxMessage[] {
    if (
      this.config.get('NODE_ENV', { infer: true }) === 'production' ||
      !(this.notifier instanceof DevNotifier)
    ) {
      throw new NotFoundException();
    }
    return this.notifier.outbox.filter((message) => !to || message.to === to);
  }
}
