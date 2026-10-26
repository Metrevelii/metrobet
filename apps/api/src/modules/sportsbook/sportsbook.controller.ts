import {
  type CompetitionEvents,
  type EventDetail,
  type Sport,
  type SportOverview,
  sportSchema,
  type SportSummary,
} from '@metrobet/contracts';
import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SportsbookStore } from './sportsbook.store.js';

/** Snapshots for first render; clients then follow changes over the Socket.IO gateway. */
@Controller('sportsbook')
export class SportsbookController {
  constructor(@Inject(SportsbookStore) private readonly store: SportsbookStore) {}

  @Get('sports')
  sports(): SportSummary[] {
    return this.store.sports();
  }

  @Get('sports/:sport')
  sport(@Param('sport', new ZodValidationPipe(sportSchema)) sport: Sport): SportOverview {
    return this.store.overview(sport);
  }

  @Get('live')
  live(): CompetitionEvents[] {
    return this.store.live();
  }

  @Get('events/:id')
  event(@Param('id') id: string): EventDetail {
    const event = this.store.event(id);
    if (!event) throw new NotFoundException(`Event "${id}" not found`);
    return event;
  }
}
