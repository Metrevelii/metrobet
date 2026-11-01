import { Injectable } from '@nestjs/common';

import { generateToken } from '../auth/tokens.js';

const PASS_TTL_MS = 60_000;

/**
 * One-time passes for the player's live channel: issued to a signed-in player (through the web
 * app, which holds the session cookie), consumed once when the socket connects. In memory: a
 * pass is used within seconds on the same instance (sticky sessions or Redis when scaling out).
 */
@Injectable()
export class PlayerSocketPasses {
  private readonly passes = new Map<string, { playerId: string; expiresAt: number }>();

  issue(playerId: string): string {
    this.sweep();
    const pass = generateToken();
    this.passes.set(pass, { playerId, expiresAt: Date.now() + PASS_TTL_MS });
    return pass;
  }

  /** The player the pass belongs to (and forgets it), or null when unknown or expired. */
  consume(pass: string): string | null {
    const entry = this.passes.get(pass);
    this.passes.delete(pass);
    return entry && entry.expiresAt > Date.now() ? entry.playerId : null;
  }

  private sweep() {
    const now = Date.now();
    for (const [pass, entry] of this.passes) if (entry.expiresAt <= now) this.passes.delete(pass);
  }
}
