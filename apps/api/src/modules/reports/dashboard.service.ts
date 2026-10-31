import type { Dashboard } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AdminBetsService } from '../betting/admin-bets.service.js';
import { AdminPlayersService } from '../players/admin-players.service.js';
import { WalletService } from '../wallet/wallet.service.js';

/** Georgia is UTC+4 all year (no daylight saving). */
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Tbilisi at the start of the day containing `now`, as an instant. */
export const tbilisiDayStart = (now: number) =>
  new Date(Math.floor((now + TBILISI_OFFSET_MS) / DAY_MS) * DAY_MS - TBILISI_OFFSET_MS);

/** Today's numbers for the backoffice dashboard, composed from the owning modules. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(AdminPlayersService) private readonly players: AdminPlayersService,
    @Inject(AdminBetsService) private readonly bets: AdminBetsService,
  ) {}

  async today(now = Date.now()): Promise<Dashboard> {
    const since = tbilisiDayStart(now);
    const [totals, newPlayers, openTickets, playerBalances] = await Promise.all([
      this.wallet.totalsSince(since),
      this.players.countSince(since),
      this.bets.countOpen(),
      this.wallet.totalPlayerBalances(),
    ]);
    return { since: since.toISOString(), ...totals, newPlayers, openTickets, playerBalances };
  }
}
