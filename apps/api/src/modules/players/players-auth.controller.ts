import {
  type ChangePasswordInput,
  changePasswordInputSchema,
  confirmVerificationInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  type PlayerAuthResponse,
  type PlayerProfile,
  type PlayerSession,
  registerInputSchema,
  resetPasswordInputSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentPlayer,
  PlayerAuthGuard,
  type PlayerPrincipal,
  sessionMeta,
} from '../auth/auth.guards.js';
import { PlayersService } from './players.service.js';

/** Player authentication. Session tokens are returned in the body; the web app keeps them in an httpOnly cookie. */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class PlayersAuthController {
  constructor(@Inject(PlayersService) private readonly players: PlayersService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerInputSchema)) input: z.output<typeof registerInputSchema>,
    @Req() request: Request,
  ): Promise<PlayerAuthResponse> {
    return this.players.register(input, sessionMeta(request));
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginInputSchema)) input: z.output<typeof loginInputSchema>,
    @Req() request: Request,
  ): Promise<PlayerAuthResponse> {
    return this.players.login(input, sessionMeta(request));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  logout(@CurrentPlayer() player: PlayerPrincipal): Promise<void> {
    return this.players.logout(player.sessionId);
  }

  @Get('me')
  @UseGuards(PlayerAuthGuard)
  me(@CurrentPlayer() player: PlayerPrincipal): Promise<PlayerProfile> {
    return this.players.me(player.playerId);
  }

  @Post('verification/send')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  sendVerification(@CurrentPlayer() player: PlayerPrincipal): Promise<void> {
    return this.players.sendVerification(player.playerId);
  }

  @Post('verification/confirm')
  @HttpCode(200)
  @UseGuards(PlayerAuthGuard)
  confirmVerification(
    @CurrentPlayer() player: PlayerPrincipal,
    @Body(new ZodValidationPipe(confirmVerificationInputSchema))
    input: z.output<typeof confirmVerificationInputSchema>,
  ): Promise<PlayerProfile> {
    return this.players.confirmVerification(player.playerId, input);
  }

  @Post('password/forgot')
  @HttpCode(204)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordInputSchema))
    input: z.output<typeof forgotPasswordInputSchema>,
  ): Promise<void> {
    return this.players.forgotPassword(input);
  }

  @Post('password/reset')
  @HttpCode(204)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordInputSchema))
    input: z.output<typeof resetPasswordInputSchema>,
  ): Promise<void> {
    return this.players.resetPassword(input);
  }

  /** Signs out every other device. 403 when the current password is wrong. */
  @Post('password/change')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  changePassword(
    @CurrentPlayer() player: PlayerPrincipal,
    @Body(new ZodValidationPipe(changePasswordInputSchema)) input: ChangePasswordInput,
  ): Promise<void> {
    return this.players.changePassword(player, input);
  }

  @Get('sessions')
  @UseGuards(PlayerAuthGuard)
  sessions(@CurrentPlayer() player: PlayerPrincipal): Promise<PlayerSession[]> {
    return this.players.listSessions(player);
  }

  @Post('sessions/revoke-others')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  revokeOthers(@CurrentPlayer() player: PlayerPrincipal): Promise<void> {
    return this.players.revokeOtherSessions(player);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(204)
  @UseGuards(PlayerAuthGuard)
  revokeSession(
    @CurrentPlayer() player: PlayerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.players.revokeSession(player, id);
  }
}
