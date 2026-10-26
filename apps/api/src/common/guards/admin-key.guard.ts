import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Env } from '../../config/env.js';

export const ADMIN_KEY_HEADER = 'x-admin-key';
/** Recorded as the audit actor until real staff accounts exist. */
export const ADMIN_KEY_ACTOR = 'backoffice:shared-key';

/**
 * TEMPORARY protection for /api/admin/* with a shared key from env.
 * Replace with staff authentication + RBAC (roadmap step 7).
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly key: Buffer;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.key = Buffer.from(config.get('ADMIN_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const provided = context.switchToHttp().getRequest<Request>().header(ADMIN_KEY_HEADER);
    const candidate = Buffer.from(provided ?? '');
    if (candidate.length !== this.key.length || !timingSafeEqual(candidate, this.key)) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
