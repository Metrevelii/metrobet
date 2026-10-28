import { ORIGINALS_DEMO_BALANCE } from '@metrobet/contracts';
import { Injectable } from '@nestjs/common';

import { generateToken } from '../../auth/tokens.js';
import type { WalletOps, WalletResult } from './originals-wallet.js';

/** Demo tokens carry this prefix, so the wallet port can route them here. */
export const DEMO_TOKEN_PREFIX = 'demo_';
const DEMO_TTL_MS = 6 * 60 * 60 * 1000;

type DemoAccount = { balance: number; expiresAt: number; settled: Map<string, number> };

/**
 * Play money for demo launches, in memory (lost on restart, which is fine for demo play). Same
 * rules as the real game wallet: idempotent transaction ids, no overspending.
 */
@Injectable()
export class DemoWallet implements WalletOps {
  private readonly accounts = new Map<string, DemoAccount>();

  open(): string {
    this.sweep();
    const token = `${DEMO_TOKEN_PREFIX}${generateToken()}`;
    this.accounts.set(token, {
      balance: ORIGINALS_DEMO_BALANCE,
      expiresAt: Date.now() + DEMO_TTL_MS,
      settled: new Map(),
    });
    return token;
  }

  balance(token: string): Promise<WalletResult> {
    const account = this.account(token);
    return Promise.resolve(
      account ? { ok: true, balance: account.balance } : { ok: false, code: 'SESSION_NOT_FOUND' },
    );
  }

  bet(token: string, { transactionId, amount }: { transactionId: string; amount: number }) {
    return this.move(token, transactionId, -amount);
  }

  win(token: string, { transactionId, amount }: { transactionId: string; amount: number }) {
    return this.move(token, transactionId, amount);
  }

  rollback(
    token: string,
    { transactionId, rollbackOf }: { transactionId: string; rollbackOf: string },
  ) {
    const account = this.account(token);
    const bet = account?.settled.get(rollbackOf);
    if (!account || bet === undefined || bet >= 0) {
      return this.balance(token);
    }
    account.settled.delete(rollbackOf);
    return this.move(token, transactionId, -bet);
  }

  private move(token: string, transactionId: string, delta: number): Promise<WalletResult> {
    const account = this.account(token);
    if (!account) return Promise.resolve({ ok: false, code: 'SESSION_NOT_FOUND' });
    if (!account.settled.has(transactionId)) {
      if (account.balance + delta < 0)
        return Promise.resolve({ ok: false, code: 'INSUFFICIENT_FUNDS' });
      account.balance += delta;
      account.settled.set(transactionId, delta);
    }
    return Promise.resolve({ ok: true, balance: account.balance });
  }

  private account(token: string) {
    const account = this.accounts.get(token);
    if (!account || account.expiresAt <= Date.now()) return null;
    return account;
  }

  private sweep() {
    const now = Date.now();
    for (const [token, account] of this.accounts)
      if (account.expiresAt <= now) this.accounts.delete(token);
  }
}
