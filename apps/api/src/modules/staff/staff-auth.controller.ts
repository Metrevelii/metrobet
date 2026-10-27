import {
  type StaffAuthResponse,
  staffLoginInputSchema,
  type StaffProfile,
} from '@metrobet/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentStaff,
  sessionMeta,
  StaffAuthGuard,
  type StaffPrincipal,
} from '../auth/auth.guards.js';
import { StaffService } from './staff.service.js';

@Controller('admin/auth')
export class StaffAuthController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  login(
    @Body(new ZodValidationPipe(staffLoginInputSchema))
    { email, password }: z.output<typeof staffLoginInputSchema>,
    @Req() request: Request,
  ): Promise<StaffAuthResponse> {
    return this.staff.login(email, password, sessionMeta(request));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(StaffAuthGuard)
  logout(@CurrentStaff() member: StaffPrincipal): Promise<void> {
    return this.staff.logout(member.sessionId);
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  me(@CurrentStaff() member: StaffPrincipal): Promise<StaffProfile> {
    return this.staff.me(member.staffId);
  }
}
