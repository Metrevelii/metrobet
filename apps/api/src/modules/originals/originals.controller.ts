import { originalGameSchema, type OriginalGame } from '@metrobet/contracts';
import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { Env } from '../../config/env.js';

type Art = { title: string[]; colors: [string, string, string]; emblem: string };

const ART: Record<OriginalGame, Art> = {
  'supra-fortune': {
    title: ['SUPRA', 'FORTUNE'],
    colors: ['#7a1631', '#2b0a1d', '#f5c451'],
    emblem: `<g font-size="120" text-anchor="middle"><text x="300" y="300">🍷</text><text x="170" y="330">🍇</text><text x="430" y="330">🥟</text></g>
<circle cx="300" cy="250" r="150" fill="none" stroke="#f5c451" stroke-opacity=".35" stroke-width="3"/>`,
  },
  'metro-jet': {
    title: ['METRO', 'JET'],
    colors: ['#0d2a5c', '#060b1c', '#c6ff3d'],
    emblem: `<path d="M60 430 C 220 420 360 330 470 150" fill="none" stroke="#c6ff3d" stroke-width="10" stroke-linecap="round"/>
<path d="M60 430 C 220 420 360 330 470 150 L 470 470 L 60 470 Z" fill="#c6ff3d" fill-opacity=".12"/>
<text x="470" y="170" font-size="110" text-anchor="middle" transform="rotate(-35 470 150)">✈️</text>
<text x="160" y="260" font-size="84" font-weight="900" fill="#c6ff3d" font-family="system-ui,sans-serif">2.47×</text>`,
  },
};

function renderArt({ title, colors: [from, to, accent], emblem }: Art): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs><radialGradient id="bg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></radialGradient></defs>
<rect width="600" height="600" fill="url(#bg)"/>
${emblem}
<rect x="24" y="24" width="168" height="40" rx="20" fill="${accent}"/>
<text x="108" y="51" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#0b0e14" text-anchor="middle" letter-spacing="2">ORIGINALS</text>
<g font-family="system-ui,sans-serif" font-weight="900" fill="#fff" text-anchor="middle">
<text x="300" y="${title.length > 1 ? 495 : 530}" font-size="64" letter-spacing="4">${title[0]}</text>
${title[1] ? `<text x="300" y="560" font-size="48" letter-spacing="10" fill="${accent}">${title[1]}</text>` : ''}
</g></svg>`;
}

/** Cover art for Originals games (stands in for a studio CDN) and the launch URL fallback. */
@Controller('originals')
export class OriginalsController {
  private readonly webUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  /**
   * Launch URLs are read by the site (`parseOriginalLaunch`) and never loaded. If one is opened
   * directly, send the visitor to the game's page on the site (Originals slugs = game ids).
   */
  @Get('play/:game')
  play(@Param('game') game: string, @Res() res: Response) {
    const parsed = originalGameSchema.safeParse(game);
    if (!parsed.success) throw new NotFoundException();
    res.redirect(302, `${this.webUrl}/slots/play/${parsed.data}`);
  }

  @Get('art/:game.svg')
  art(@Param('game') game: string, @Res() res: Response) {
    const parsed = originalGameSchema.safeParse(game);
    if (!parsed.success) throw new NotFoundException();
    res
      .type('image/svg+xml')
      .set({
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      })
      .send(renderArt(ART[parsed.data]));
  }
}
