import { DEFAULT_CURRENCY, type GameWalletError } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { GameWalletClient } from '../../../common/game-wallet/game-wallet-client.js';
import { DEMO_TOKEN_PREFIX, DemoWallet } from './demo-wallet.js';

/** `null` code: no usable answer (network, 5xx). The outcome is unknown: retry or roll back. */
export type WalletResult =
  { ok: true; balance: number } | { ok: false; code: GameWalletError | null };

type Move = { transactionId: string; roundId: string; amount: number };

export interface WalletOps {
  balance(token: string): Promise<WalletResult>;
  bet(token: string, move: Move): Promise<WalletResult>;
  win(token: string, move: Move): Promise<WalletResult>;
  rollback(
    token: string,
    move: { transactionId: string; roundId: string; rollbackOf: string },
  ): Promise<WalletResult>;
}

/**
 * The Originals game server's wallet: real sessions settle through the signed game wallet API
 * (exactly like an external provider), demo sessions use play money in `DemoWallet`. Game code
 * never knows which one it talks to.
 */
@Injectable()
export class OriginalsWallet implements WalletOps {
  constructor(
    @Inject(GameWalletClient) private readonly client: GameWalletClient,
    @Inject(DemoWallet) private readonly demo: DemoWallet,
  ) {}

  isDemo(token: string) {
    return token.startsWith(DEMO_TOKEN_PREFIX);
  }

  balance(token: string) {
    return this.isDemo(token)
      ? this.demo.balance(token)
      : this.real('balance', { sessionToken: token });
  }

  bet(token: string, move: Move) {
    return this.isDemo(token)
      ? this.demo.bet(token, move)
      : this.real('bet', { sessionToken: token, ...move, currency: DEFAULT_CURRENCY });
  }

  /** Always closes the round (Originals rounds have one win call, 0 for a loss). */
  win(token: string, move: Move) {
    return this.isDemo(token)
      ? this.demo.win(token, move)
      : this.real('win', {
          sessionToken: token,
          ...move,
          currency: DEFAULT_CURRENCY,
          roundClosed: true,
        });
  }

  rollback(token: string, move: { transactionId: string; roundId: string; rollbackOf: string }) {
    return this.isDemo(token)
      ? this.demo.rollback(token, move)
      : this.real('rollback', { sessionToken: token, ...move });
  }

  private async real(
    operation: 'balance' | 'bet' | 'win' | 'rollback',
    payload: object,
  ): Promise<WalletResult> {
    const result = await this.client.call(operation, payload);
    return result.ok ? { ok: true, balance: result.data.balance } : result;
  }
}
