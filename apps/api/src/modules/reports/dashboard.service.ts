import { type Dashboard, tbilisiDayStart } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AdminBetsService } from '../betting/admin-bets.service.js';
import { AdminPlayersService } from '../players/admin-players.service.js';
import { WalletService } from '../wallet/wallet.service.js';

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
