import { randomUUID } from 'node:crypto';

import { DEFAULT_CURRENCY, type GameWalletError } from '@metrobet/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { spinSlot } from './mock-slot-math.js';
import { GameWalletClient } from '../../../../common/game-wallet/game-wallet-client.js';

export type MockSpinResult =
  | { ok: true; reels: number[]; win: number; balance: number }
  | { ok: false; code: GameWalletError | 'UNAVAILABLE' };

const WIN_ATTEMPTS = 3;

/**
 * The mock studio's game server for real-money slot rounds. It never touches our database: it
 * decides the outcome, then settles through the signed game wallet API like a real provider
 * (bet → win, or bet → rollback when the bet's outcome is unknown).
 */
@Injectable()
export class MockGameServer {
  private readonly logger = new Logger(MockGameServer.name);

  constructor(@Inject(GameWalletClient) private readonly wallet: GameWalletClient) {}

  async balance(sessionToken: string) {
    return this.wallet.call('balance', { sessionToken });
  }

  async spin(sessionToken: string, bet: number): Promise<MockSpinResult> {
    const roundId = `mock-round:${randomUUID()}`;
    const betId = `mock-bet:${randomUUID()}`;
    const placed = await this.wallet.call('bet', {
      sessionToken,
      transactionId: betId,
      roundId,
      amount: bet,
      currency: DEFAULT_CURRENCY,
    });
    if (!placed.ok) {
      // Unknown outcome: the bet may have gone through, so cancel it (rollbacks are idempotent).
      if (placed.code === null) {
        await this.wallet.call('rollback', {
          sessionToken,
          transactionId: `mock-rollback:${randomUUID()}`,
          roundId,
          rollbackOf: betId,
        });
      }
      return { ok: false, code: placed.code ?? 'UNAVAILABLE' };
    }

    const { reels, multiplier } = spinSlot();
    const win = bet * multiplier;
    const winId = `mock-win:${randomUUID()}`;
    // A win must be delivered: retry with the same transaction id (idempotent on our side).
    for (let attempt = 1; attempt <= WIN_ATTEMPTS; attempt++) {
      const paid = await this.wallet.call('win', {
        sessionToken,
        transactionId: winId,
        roundId,
        amount: win,
        currency: DEFAULT_CURRENCY,
        roundClosed: true,
      });
      if (paid.ok) return { ok: true, reels, win, balance: paid.data.balance };
      if (paid.code !== null) break;
    }
    // A real provider queues it for reconciliation; the round stays open in game_rounds.
    this.logger.error(`Win ${winId} for round ${roundId} could not be delivered`);
    return { ok: false, code: 'UNAVAILABLE' };
  }
}
