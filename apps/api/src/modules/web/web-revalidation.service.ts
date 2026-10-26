import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';

/**
 * Tells the player site to drop cached data for the given tags after admin changes.
 * Best effort: a failure is logged and the site catches up when its cache expires.
 */
@Injectable()
export class WebRevalidationService {
  private readonly logger = new Logger(WebRevalidationService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async revalidate(...tags: string[]): Promise<void> {
    const url = new URL('/api/revalidate', this.config.get('WEB_URL', { infer: true }));
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': this.config.get('WEB_REVALIDATE_SECRET', { infer: true }),
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      this.logger.warn(`Could not revalidate [${tags.join(', ')}] on ${url}: ${String(error)}`);
    }
  }
}
