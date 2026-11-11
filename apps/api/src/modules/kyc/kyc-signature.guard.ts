import { createHmac, timingSafeEqual } from 'node:crypto';

import { KYC_SIGNATURE_HEADER } from '@metrobet/contracts';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  type RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Env } from '../../config/env.js';

/** Only the provider knows `KYC_PROVIDER_SECRET`: checks the HMAC of the raw body in constant time. */
@Injectable()
export class KycSignatureGuard implements CanActivate {
  private readonly secret: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.secret = config.get('KYC_PROVIDER_SECRET', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const given = Buffer.from(request.header(KYC_SIGNATURE_HEADER) ?? '', 'hex');
    const expected = createHmac('sha256', this.secret)
      .update(request.rawBody ?? '')
      .digest();
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Missing or wrong signature');
    }
    return true;
  }
}
