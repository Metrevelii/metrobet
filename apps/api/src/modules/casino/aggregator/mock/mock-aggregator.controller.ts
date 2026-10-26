import { localeSchema } from '@metrobet/contracts';
import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { Env } from '../../../../config/env.js';
import { findMockGame } from './mock-aggregator.js';
import { renderMockDemoPage } from './mock-demo-page.js';
import { renderMockThumbnail } from './mock-thumbnail.js';

/** Stands in for the aggregator's CDN and game servers while the mock adapter is bound. */
@Controller('casino/mock')
export class MockAggregatorController {
  private readonly frameAncestors: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.frameAncestors = config.get('CORS_ORIGINS', { infer: true }).join(' ');
  }

  @Get('thumbnails/:id.svg')
  thumbnail(@Param('id') id: string, @Res() res: Response) {
    const game = findMockGame(id);
    if (!game) throw new NotFoundException();
    res
      .type('image/svg+xml')
      .set({
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      })
      .send(renderMockThumbnail(game.provider, game.title));
  }

  @Get('play/:id')
  play(@Param('id') id: string, @Query('lang') lang: string | undefined, @Res() res: Response) {
    const game = findMockGame(id);
    if (!game) throw new NotFoundException();
    const locale = localeSchema.catch('en').parse(lang);
    res
      .type('html')
      .set({
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors ${this.frameAncestors}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      })
      .send(
        renderMockDemoPage({
          title: game.title,
          provider: game.provider.name,
          type: game.provider.type,
          locale,
        }),
      );
  }
}
