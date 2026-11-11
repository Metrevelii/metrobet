import {
  type AdminBonus,
  type BonusCancel,
  bonusCancelSchema,
  localeSchema,
  type PlayerBonuses,
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
  Query,
  UseGuards,
} from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentPlayer,
  CurrentStaff,
  PlayerAuthGuard,
  type PlayerPrincipal,
  Roles,
  StaffAuthGuard,
  type StaffPrincipal,
  staffActor,
} from '../auth/auth.guards.js';
import { BonusService } from './bonus.service.js';

/** The player's bonuses (active one with wagering progress, then history). */
@Controller('bonuses')
@UseGuards(PlayerAuthGuard)
export class BonusController {
  constructor(@Inject(BonusService) private readonly bonuses: BonusService) {}

  @Get()
  list(
    @CurrentPlayer() { playerId }: PlayerPrincipal,
    @Query('locale') locale: string | undefined,
  ): Promise<PlayerBonuses> {
    return this.bonuses.overview(playerId, localeSchema.catch('ka').parse(locale));
  }
}

@Controller('admin')
@UseGuards(StaffAuthGuard)
@Roles('support', 'risk', 'finance', 'marketing')
export class AdminBonusController {
  constructor(@Inject(BonusService) private readonly bonuses: BonusService) {}

  @Get('players/:id/bonuses')
  list(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminBonus[]> {
    return this.bonuses.adminList(id);
  }

  /** Ends an active bonus; its money goes back (support, risk). */
  @Post('bonuses/:id/cancel')
  @HttpCode(200)
  @Roles('support', 'risk')
  cancel(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(bonusCancelSchema)) { reason }: BonusCancel,
  ): Promise<AdminBonus> {
    return this.bonuses.cancel(staffActor(staff), id, reason);
  }
}
