# Responsible gaming (api)

The player's own protection tools: **limits**, the **reality check** and **take a break /
self-exclusion**. Every product honours them: sportsbook placement, the game wallet (casino and
Originals) and deposits.

## Limits (`rg_limits`, `limits.ts`)

- Kinds: `deposit` (money paid in), `stake` (bets minus rolled-back bets), `loss` (stakes minus
  wins and cash-outs, never below 0). Periods are **rolling** windows: 24 h, 7 days, 30 days.
  Usage comes from the ledger (`WalletService.playerActivity`, one query for all windows).
- **Stricter applies at once, looser waits** (`changeLimit`): a new or lower limit is in force
  immediately and cancels a pending raise; a raise or removal waits 24 h in
  `pendingAmount`/`pendingAt` while the old limit stays. Asking for the current amount cancels a
  pending change. Due changes are applied on read (`resolveLimit`), no job needed.
- Checks (`assertCanStake`, `assertCanDeposit`) throw `LimitExceededError { kind, period,
remaining }`. A new stake counts fully towards stake **and** loss limits (it may be lost).
  Players without limits cost one indexed select, no ledger query.
- Callers map the error to their protocol: betting → `LIMIT_EXCEEDED` (403, `limit` in the body),
  game wallet → `LIMIT_EXCEEDED` (403), dev deposit → `limitErrorSchema` (403).
- Known gap: the check runs before the money moves, not under the ledger lock, so two bets in
  the same instant can pass together and go over by one stake.

## Reality check (`rg_settings`)

`realityCheckMinutes` (15/30/60/120 or null). The web app shows the reminder; the API only
stores the interval and answers `GET activity?since` (stakes, returns, net; at most 24 h back).

## Exclusion

`POST exclusion { period, password }` (1d/7d/30d break, 6m/1y/permanent self-exclusion) sets the
player `self_excluded` with `players.excludedUntil` (null = permanent) and revokes every session.
The password must match (403) so an open session alone can't lock a player out. Players can't end
it early; login turns the account `active` again once `excludedUntil` has passed. A staff status
change clears `excludedUntil` (staff decisions are open-ended).

## Endpoints

| Method  | Path                                    | Auth                   | Notes                                  |
| ------- | --------------------------------------- | ---------------------- | -------------------------------------- |
| GET     | `/responsible-gaming`                   | player                 | limits (used, pending) + reality check |
| PUT     | `/responsible-gaming/limits`            | player                 | `{ kind, period, amount \| null }`     |
| GET/PUT | `/responsible-gaming/reality-check`     | player                 | `{ minutes }`                          |
| GET     | `/responsible-gaming/activity?since=`   | player                 | `PlayActivity`                         |
| POST    | `/responsible-gaming/exclusion`         | player (throttled)     | 204, signs out everywhere              |
| GET     | `/admin/players/:id/responsible-gaming` | support, risk, finance | read-only                              |

Every player change is audit-logged with actor `player:<id>` (`player.limit`,
`player.self_exclusion`).
