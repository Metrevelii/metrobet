import { randomInt, randomUUID } from 'node:crypto';

import {
  type OriginalsAck,
  SUPRA_STRIPS,
  type SupraSpinResult,
  supraGrid,
  supraWins,
} from '@metrobet/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { OriginalsWallet } from '../wallet/originals-wallet.js';

const WIN_ATTEMPTS = 3;

/** Uniform, independent reel stops from a CSPRNG. */
export const randomStops = () => SUPRA_STRIPS.map((strip) => randomInt(strip.length));

/**
 * Supra Fortune game server. Decides the stops, then settles the round through the wallet:
 * bet → win (0 for a loss closes the round). A bet whose outcome is unknown is rolled back.
 */
@Injectable()
export class SupraFortuneService {
  private readonly logger = new Logger(SupraFortuneService.name);

  constructor(@Inject(OriginalsWallet) private readonly wallet: OriginalsWallet) {}

  async spin(token: string, bet: number): Promise<OriginalsAck<SupraSpinResult>> {
    const id = randomUUID();
    const roundId = `supra:${id}`;
    const betId = `supra-bet:${id}`;
    const placed = await this.wallet.bet(token, { transactionId: betId, roundId, amount: bet });
    if (!placed.ok) {
      if (placed.code === null) {
        await this.wallet.rollback(token, {
          transactionId: `supra-rollback:${id}`,
          roundId,
          rollbackOf: betId,
        });
      }
      return { ok: false, code: placed.code ?? 'UNAVAILABLE' };
    }

    const stops = randomStops();
    const wins = supraWins(supraGrid(stops), bet);
    const win = wins.reduce((sum, line) => sum + line.amount, 0);
    for (let attempt = 1; attempt <= WIN_ATTEMPTS; attempt++) {
      const paid = await this.wallet.win(token, {
        transactionId: `supra-win:${id}`,
        roundId,
        amount: win,
      });
      if (paid.ok) return { ok: true, data: { stops, wins, win, balance: paid.balance } };
      if (paid.code !== null) break;
    }
    // The round stays open in game_rounds for reconciliation.
    this.logger.error(`Win for Supra Fortune round ${roundId} could not be delivered`);
    return { ok: false, code: 'UNAVAILABLE' };
  }
}
