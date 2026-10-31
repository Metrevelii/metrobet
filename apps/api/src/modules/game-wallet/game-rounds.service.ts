import type { AdminGameRoundsPage } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { gameRounds } from './game-wallet.schema.js';

/** Read side of provider rounds (staff views). */
@Injectable()
export class GameRoundsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** A player's rounds, newest first. */
  async listForPlayer(
    playerId: string,
    page: number,
    pageSize: number,
  ): Promise<AdminGameRoundsPage> {
    const where = eq(gameRounds.playerId, playerId);
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(gameRounds)
        .where(where)
        .orderBy(desc(gameRounds.openedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(gameRounds).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        gameSlug: row.gameSlug,
        externalId: row.externalId,
        status: row.status,
        betTotal: row.betTotal,
        winTotal: row.winTotal,
        openedAt: row.openedAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
      })),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  }
}
