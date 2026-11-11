import {
  type KycCallback,
  kycCallbackSchema,
  type KycOverview,
  type KycStarted,
} from '@metrobet/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentPlayer, PlayerAuthGuard, type PlayerPrincipal } from '../auth/auth.guards.js';
import { KycSignatureGuard } from './kyc-signature.guard.js';
import { KycService } from './kyc.service.js';

@Controller('kyc')
export class KycController {
  constructor(@Inject(KycService) private readonly kyc: KycService) {}

  @Get()
  @UseGuards(PlayerAuthGuard)
  overview(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<KycOverview> {
    return this.kyc.overview(playerId);
  }

  /** Returns the provider's page URL; the browser goes there. 409 when verified or in review. */
  @Post('checks')
  @UseGuards(PlayerAuthGuard)
  start(@CurrentPlayer() { playerId }: PlayerPrincipal): Promise<KycStarted> {
    return this.kyc.start(playerId);
  }

  /** Server to server: the provider's result. Signed; safe to repeat. */
  @Post('callback')
  @HttpCode(200)
  @UseGuards(KycSignatureGuard)
  async callback(
    @Body(new ZodValidationPipe(kycCallbackSchema)) callback: KycCallback,
  ): Promise<{ ok: true }> {
    await this.kyc.handleCallback(callback);
    return { ok: true };
  }
}
