# Bonus (api)

**Bonus money**: a separate balance with a wagering requirement and an expiry. The money is the
player's `bonus` wallet account (ledger); `bonuses` rows hold the terms and progress. At most
one `active` bonus per player (partial unique index).

## Money rules

- **Grant** (`grant`, called by promo mechanics): `marketing` → `bonus` (`bonus_grant`,
  `bonus:<id>:grant`). Idempotent by `grantKey`; refused (null) while another bonus is active.
- **Spending**: every stake goes through `Ledger.postStake`: cash first, then bonus money,
  decided under the account locks. The stake's bonus part is remembered (`bet_tickets.bonus_stake`,
  `game_rounds.bonus_bet_total`, `game_transactions.bonus_amount`).
- **Payouts** (wins, cash-outs, refunds, voids) go back **in the stake's proportions**
  (`bonusShare`, rounded down; `payoutLegs`): the bonus share to `bonus`, the rest to cash.
  Refunds return exactly what was taken.
- **Wagering**: real bets on the activity bus count their full stake: casino always, sports
  tickets at total odds ≥ `BONUS_SPORTS_MIN_ODDS` (1.50). At `wageringRequired` the whole bonus
  balance becomes cash (`bonus_convert`, `bonus:<id>:convert`), status `completed`.
- **Ended early**: `forfeited` (the player withdrew; payments asks them to confirm first),
  `expired`, `cancelled` (staff, with a reason, audit-logged `bonus.cancel`). The bonus balance
  goes back to `marketing` (`bonus_forfeit`, `bonus:<id>:end`).
- **Stray money**: a ticket or round settled after its bonus ended still pays its bonus share
  into `bonus`. `settleStray` sends it after the bonus's fate: completed → cash, otherwise →
  `marketing`. Runs before every grant, on reads and in the sweep.
- **Sweep** (`BONUS_SWEEP=on`, every minute; e2e calls `sweep()`): expires due bonuses and
  settles stray money. Reads also expire a due bonus lazily (`current`).

The balance players see in the header, games and the betslip is **cash + bonus** (playable);
the wallet page splits it. Withdrawals only ever take cash.

## Endpoints

| Method | Path                         | Auth                              | Notes                                     |
| ------ | ---------------------------- | --------------------------------- | ----------------------------------------- |
| GET    | `/bonuses?locale=`           | player                            | `{ active, history }`, titles in `locale` |
| GET    | `/admin/players/:id/bonuses` | support, risk, finance, marketing | with balances and progress                |
| POST   | `/admin/bonuses/:id/cancel`  | support, risk                     | `{ reason }`; 409 when not active         |

## Known gaps

Wagering progress counts bets after commit through the bus (lost if a subscriber fails, like
promotions). Free-spin and sportsbook free-bet bonuses are not modelled yet.
