import {
  GAME_WALLET_SIGNATURE_HEADER,
  type GameWalletError,
  gameWalletErrorSchema,
  type GameWalletOperation,
  type GameWalletResponse,
  gameWalletResponseSchema,
} from '@metrobet/contracts';
import { createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';

export type WalletCallResult =
  | { ok: true; data: GameWalletResponse }
  /** `null` code: no usable answer (network error, 5xx): the outcome is unknown. */
  | { ok: false; code: GameWalletError | null };

export type RawResponse = { status: number; body: unknown };

/**
 * Provider-side client for our game wallet API, used by our own game servers (the mock studio,
 * Metrobet Originals): signs each body with GAME_WALLET_SECRET and POSTs it over HTTP, exactly
 * like an external provider. `send` is the transport (tests swap it).
 */
@Injectable()
export class GameWalletClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.baseUrl = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/game-wallet`;
    this.secret = config.get('GAME_WALLET_SECRET', { infer: true });
  }

  async call(operation: GameWalletOperation, payload: object): Promise<WalletCallResult> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    let response: RawResponse;
    try {
      response = await this.send(`/${operation}`, body, {
        'content-type': 'application/json',
        [GAME_WALLET_SIGNATURE_HEADER]: signature,
      });
    } catch {
      return { ok: false, code: null };
    }
    if (response.status === 200) {
      const data = gameWalletResponseSchema.safeParse(response.body);
      return data.success ? { ok: true, data: data.data } : { ok: false, code: null };
    }
    const error = gameWalletErrorSchema.safeParse(response.body);
    return { ok: false, code: error.success ? error.data.code : null };
  }

  protected async send(
    path: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<RawResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }
}
