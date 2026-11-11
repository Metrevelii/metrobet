import { createHmac } from 'node:crypto';

import { KYC_SIGNATURE_HEADER, type KycCallback } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../../../config/env.js';

/**
 * The mock provider's webhook: signs the body with the provider secret and POSTs it to our
 * callback over real HTTP. `send` is the transport (tests swap it).
 */
@Injectable()
export class MockKycCallbacks {
  private readonly url: string;
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.url = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/kyc/callback`;
    this.secret = config.get('KYC_PROVIDER_SECRET', { infer: true });
  }

  /** True when we (the merchant) accepted the callback. */
  async notify(callback: KycCallback): Promise<boolean> {
    const body = JSON.stringify(callback);
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    try {
      const status = await this.send(body, {
        'content-type': 'application/json',
        [KYC_SIGNATURE_HEADER]: signature,
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
