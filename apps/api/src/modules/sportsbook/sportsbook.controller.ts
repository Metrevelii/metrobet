import {
  type CompetitionEvents,
  type CompetitionSummary,
  type EventDetail,
  type Sport,
  type SportOverview,
  sportOverviewQuerySchema,
  sportSchema,
  type SportSummary,
} from '@metrobet/contracts';
import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { z } from 'zod';

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

  /** `?day=all|today|tomorrow|soon&competitions=id,id` */
  @Get('sports/:sport')
  sport(
    @Param('sport', new ZodValidationPipe(sportSchema)) sport: Sport,
    @Query(new ZodValidationPipe(sportOverviewQuerySchema))
    query: z.output<typeof sportOverviewQuerySchema>,
  ): SportOverview {
    return this.store.overview(sport, query);
  }

  @Get('sports/:sport/competitions')
  competitions(
    @Param('sport', new ZodValidationPipe(sportSchema)) sport: Sport,
  ): CompetitionSummary[] {
    return this.store.competitions(sport);
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
