import type { HealthResponse } from '@metrobet/contracts';
import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const database = await this.db.execute(sql`select 1`).then(
      () => 'up' as const,
      () => 'down' as const,
    );

    return {
      status: database,
      uptime: process.uptime(),
      services: { database },
    };
  }
}
