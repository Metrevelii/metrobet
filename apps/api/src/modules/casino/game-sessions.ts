import type { GameType } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { generateToken, sha256 } from '../auth/tokens.js';
import { casinoGames } from './casino.schema.js';
import { casinoGameSessions } from './game-sessions.schema.js';

/** How long a launched game may take new bets. */
export const GAME_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export type GameSession = {
  id: string;
  playerId: string;
  gameSlug: string;
  gameType: GameType;
  /** True after `expiresAt`: no new bets, but wins/rollbacks still settle. */
  expired: boolean;
};

/** Opens real-money sessions on launch and resolves the token the provider sends back. */
@Injectable()
export class GameSessions {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Returns the raw token for the launch URL (never stored). */
  async open(playerId: string, gameId: string): Promise<string> {
    const token = generateToken();
    await this.db.insert(casinoGameSessions).values({
      tokenHash: sha256(token),
      playerId,
      gameId,
      expiresAt: new Date(Date.now() + GAME_SESSION_TTL_MS),
    });
    return token;
  }

  async resolve(token: string): Promise<GameSession | null> {
    const [row] = await this.db
      .select({
        id: casinoGameSessions.id,
        playerId: casinoGameSessions.playerId,
        expiresAt: casinoGameSessions.expiresAt,
        gameSlug: casinoGames.slug,
        gameType: casinoGames.type,
      })
      .from(casinoGameSessions)
      .innerJoin(casinoGames, eq(casinoGameSessions.gameId, casinoGames.id))
      .where(eq(casinoGameSessions.tokenHash, sha256(token)));
    if (!row) return null;
    const { expiresAt, ...session } = row;
    return { ...session, expired: expiresAt.getTime() <= Date.now() };
  }
}
