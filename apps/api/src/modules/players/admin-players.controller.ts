import {
  type AdminPlayer,
  type AdminPlayersPage,
  adminPlayersQuerySchema,
  type PlayerStatusUpdate,
  playerStatusUpdateSchema,
} from '@metrobet/contracts';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentStaff,
  Roles,
  StaffAuthGuard,
  type StaffPrincipal,
  staffActor,
} from '../auth/auth.guards.js';
import { AdminPlayersService } from './admin-players.service.js';

@Controller('admin/players')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance')
export class AdminPlayersController {
  constructor(@Inject(AdminPlayersService) private readonly players: AdminPlayersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminPlayersQuerySchema))
    query: z.output<typeof adminPlayersQuerySchema>,
  ): Promise<AdminPlayersPage> {
    return this.players.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPlayer> {
    return this.players.get(id);
  }

  /** Suspend / self-exclude / reactivate (support and risk only). */
  @Patch(':id/status')
  @Roles('support', 'risk')
  setStatus(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(playerStatusUpdateSchema)) input: PlayerStatusUpdate,
  ): Promise<AdminPlayer> {
    return this.players.setStatus(staffActor(staff), id, input);
  }
}
