# Player live module (api)

The signed-in player's private live channel: **balance changes** and **settled tickets** pushed
the moment they commit (header balance, "Your ticket won" toasts on the site).

## Flow

```
any ledger transaction / ticket settlement ──(Postgres trigger)──▶ pg_notify on COMMIT
   ──▶ PgListener (one LISTEN connection) ──▶ PlayerLiveGateway ──▶ room player:<id>
browser ──server action──▶ web ──POST /api/player-live/pass (session)──▶ one-time pass
browser ──Socket.IO /player, auth: { pass }──▶ joins its room
```

## Rules

- **Triggers, not code paths** (migration `0015_player_live_notify`): `wallet_accounts` balance
  updates of player accounts → `player_balance`; `bet_tickets` going from `open` to won / lost /
  void → `ticket_settled` (cash-outs are left out: the player started them). No caller has to
  remember to notify, and Postgres delivers a notification **only when its transaction commits**,
  so a rollback is never pushed (covered by e2e).
- **The session token never reaches the browser.** The web app (holding the httpOnly cookie)
  asks `POST /api/player-live/pass` for a one-time pass (60 s, single use, in memory) and the
  client connects with it. Socket.IO calls the `auth` function on every reconnect, so each
  reconnect gets a fresh pass. An invalid pass gets `exception` and a disconnect.
- `PgListener` uses its own `pg` connection (LISTEN needs one), reconnects every 2 s on failure.
  Every API instance hears every notification, so this scales out as long as passes are issued
  and used on the same instance (sticky sessions) or moved to Redis.

## Events (contracts `realtime/player.ts`)

| Event            | Payload                                     |
| ---------------- | ------------------------------------------- |
| `balance`        | `{ balance }` (minor units)                 |
| `ticket:settled` | `{ ticketId, status, mode, stake, payout }` |

## Not yet

Promo events (spins available, prizes), deposit/withdrawal confirmations from payments, a
notification inbox (history) for players who were offline.
