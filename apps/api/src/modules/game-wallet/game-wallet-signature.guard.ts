import { createHmac, timingSafeEqual } from 'node:crypto';

import { GAME_WALLET_SIGNATURE_HEADER } from '@metrobet/contracts';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Env } from '../../config/env.js';
import { gameWalletError } from './game-wallet.service.js';

/** Hex HMAC-SHA256 of the exact request body bytes: what providers send and we verify. */
export const signGameWalletBody = (secret: string, body: string | Buffer) =>
  createHmac('sha256', secret).update(body).digest('hex');

/**
 * Only the game provider knows `GAME_WALLET_SECRET`. Verifies the signature over the raw body
 * (the app is created with `rawBody: true`), in constant time.
 */
@Injectable()
export class GameWalletSignatureGuard implements CanActivate {
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.secret = config.get('GAME_WALLET_SECRET', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const given = Buffer.from(request.header(GAME_WALLET_SIGNATURE_HEADER) ?? '', 'hex');
    const expected = Buffer.from(signGameWalletBody(this.secret, request.rawBody ?? ''), 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw gameWalletError('INVALID_SIGNATURE', 'Missing or wrong request signature');
    }
    return true;
  }
}
