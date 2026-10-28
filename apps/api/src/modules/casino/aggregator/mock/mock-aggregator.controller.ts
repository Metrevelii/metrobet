import { type GameWalletError, localeSchema } from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';

import type { Env } from '../../../../config/env.js';
import { hash, MOCK_PROVIDERS } from './mock-catalog.js';
import { findMockGame } from './mock-aggregator.js';
import { renderMockDemoPage } from './mock-demo-page.js';
import { MockGameServer } from './mock-game-server.js';
import { SLOT_BETS } from './mock-slot-math.js';
import { renderMockThumbnail } from './mock-thumbnail.js';

const sessionSchema = z.string().min(1).max(200);
const spinSchema = z.object({
  session: sessionSchema,
  bet: z.number().refine((bet) => SLOT_BETS.includes(bet), 'Not an offered bet size'),
});

const SPIN_ERROR_STATUS: Partial<Record<GameWalletError | 'UNAVAILABLE', HttpStatus>> = {
  INVALID_REQUEST: HttpStatus.BAD_REQUEST,
  INSUFFICIENT_FUNDS: HttpStatus.PAYMENT_REQUIRED,
  SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  SESSION_EXPIRED: HttpStatus.FORBIDDEN,
  PLAYER_BLOCKED: HttpStatus.FORBIDDEN,
};

/** The mock game client's own error body (`code` only: the page picks the message). */
const gameError = (code: GameWalletError | 'UNAVAILABLE' | null) =>
  new HttpException(
    { code: code ?? 'UNAVAILABLE' },
    (code && SPIN_ERROR_STATUS[code]) ?? HttpStatus.BAD_GATEWAY,
  );

/**
 * Stands in for the aggregator's CDN and game servers while the mock adapter is bound. The
 * `play/:id/*` routes are the studio's game server, called by its own game page.
 */
@Controller('casino/mock')
export class MockAggregatorController {
  private readonly frameAncestors: string;
  private readonly siteOrigin: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(MockGameServer) private readonly gameServer: MockGameServer,
  ) {
    this.frameAncestors = config.get('CORS_ORIGINS', { infer: true }).join(' ');
    this.siteOrigin = new URL(config.get('WEB_URL', { infer: true })).origin;
  }

  @Get('thumbnails/:id.svg')
  thumbnail(@Param('id') id: string, @Res() res: Response) {
    const game = findMockGame(id);
    if (!game) throw new NotFoundException();
    this.sendSvg(res, renderMockThumbnail(game.provider, game.title));
  }

  /** Generated cover for any title (used for real demo games without an official image). */
  @Get('art/:title.svg')
  art(
    @Param('title') title: string,
    @Query('studio') studio: string | undefined,
    @Res() res: Response,
  ) {
    const name = title.slice(0, 60);
    const studioName = (studio ?? '').slice(0, 40);
    const palette = MOCK_PROVIDERS[hash(name) % MOCK_PROVIDERS.length]!.palette;
    this.sendSvg(
      res,
      renderMockThumbnail({ id: 'art', name: studioName, palette, type: 'slot', games: [] }, name),
    );
  }

  @Get('play/:id')
  play(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('mode') mode: string | undefined,
    @Query('session') session: string | undefined,
    @Res() res: Response,
  ) {
    const game = findMockGame(id);
    if (!game) throw new NotFoundException();
    const locale = localeSchema.catch('en').parse(lang);
    const real =
      mode === 'real' && sessionSchema.safeParse(session).success
        ? { session: session!, parentOrigin: this.siteOrigin }
        : undefined;
    res
      .type('html')
      .set({
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors ${this.frameAncestors}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      })
      .send(
        renderMockDemoPage({
          title: game.title,
          provider: game.provider.name,
          type: game.provider.type,
          locale,
          real,
        }),
      );
  }

  /** Game server: the player's balance for the game page (via our game wallet API). */
  @Get('play/:id/balance')
  async balance(@Param('id') id: string, @Query('session') session: string | undefined) {
    if (!findMockGame(id)) throw new NotFoundException();
    const parsed = sessionSchema.safeParse(session);
    if (!parsed.success) throw gameError('SESSION_NOT_FOUND');
    const result = await this.gameServer.balance(parsed.data);
    if (!result.ok) throw gameError(result.code);
    return { balance: result.data.balance };
  }

  /** Game server: one real-money slot spin. The outcome is decided here, never in the page. */
  @Post('play/:id/spin')
  @HttpCode(200)
  async spin(@Param('id') id: string, @Body() body: unknown) {
    const game = findMockGame(id);
    if (game?.provider.type !== 'slot') throw new NotFoundException();
    const parsed = spinSchema.safeParse(body);
    if (!parsed.success) throw gameError('INVALID_REQUEST');
    const result = await this.gameServer.spin(parsed.data.session, parsed.data.bet);
    if (!result.ok) throw gameError(result.code);
    const { ok: _ok, ...spin } = result;
    return spin;
  }

  private sendSvg(res: Response, svg: string) {
    res
      .type('image/svg+xml')
      .set({
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      })
      .send(svg);
  }
}
