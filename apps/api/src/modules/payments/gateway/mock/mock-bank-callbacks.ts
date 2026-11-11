import { createHmac } from 'node:crypto';

import { PAYMENT_SIGNATURE_HEADER, type PaymentCallback } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../../../config/env.js';

/**
 * The mock bank's side of the callback: signs the body with the gateway secret and POSTs it to
 * our callback URL over real HTTP, like a bank would. `send` is the transport (tests swap it).
 */
@Injectable()
export class MockBankCallbacks {
  private readonly url: string;
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.url = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/payments/callback`;
    this.secret = config.get('PAYMENT_GATEWAY_SECRET', { infer: true });
  }

  /** True when the merchant (us) accepted the callback. */
  async notify(callback: PaymentCallback): Promise<boolean> {
    const body = JSON.stringify(callback);
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    try {
      const status = await this.send(body, {
        'content-type': 'application/json',
        [PAYMENT_SIGNATURE_HEADER]: signature,
      });
      return status === 200;
    } catch {
      return false;
    }
  }

  protected async send(body: string, headers: Record<string, string>): Promise<number> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    });
    return response.status;
  }
}
