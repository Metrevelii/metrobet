import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../../../config/env.js';
import { KycProvider } from '../kyc-provider.js';
import { signKycSession } from './mock-kyc-token.js';

const SESSION_TTL_MS = 60 * 60 * 1000;

/** Stand-in for Sumsub / Veriff: its verification page is served by this API (`MockKycController`). */
@Injectable()
export class MockKycProvider extends KycProvider {
  readonly name = 'mock';
  private readonly secret: string;
  private readonly pageUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.secret = config.get('KYC_PROVIDER_SECRET', { infer: true });
    this.pageUrl = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/kyc/mock/verify`;
  }

  startCheck(input: { checkId: string; returnUrl: string }) {
    const token = signKycSession(this.secret, { ...input, exp: Date.now() + SESSION_TTL_MS });
    return Promise.resolve({ redirectUrl: `${this.pageUrl}?t=${token}` });
  }
}
