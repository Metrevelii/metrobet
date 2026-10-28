# Game wallet module (api)

The **seamless wallet API** game providers call, server to server, to settle real-money rounds:
`balance`, `bet`, `win`, `rollback`. It turns provider calls into ledger transactions
(`wallet` module), keeps rounds for history/stats, and publishes real bets on the activity bus
(so promotions such as the wheel count them).

## Flow

```
player ──POST /casino/games/:slug/sessions──▶ casino: game session (token in the launch URL)
game client ──▶ provider game server ──signed POST /game-wallet/*──▶ GameWalletService
    ──one DB transaction──▶ game_rounds + game_transactions + Ledger.post (savepoint)
    ──after commit (bets)──▶ ActivityBus `casino.bet`
```

The protocol (request/response/error schemas, signature header) is in contracts
`casino/game-wallet.ts`. Every request is a JSON POST signed with **HMAC-SHA256 of the raw body**
(hex) using `GAME_WALLET_SECRET`; the app runs with `rawBody: true` for this. Errors are
`{ code, message }` with a 4xx status; providers branch on `code`.

## Rules (keep these when changing anything)

1. **Idempotent by the provider's transaction id** (`game_transactions.externalId`). The same id
   with the same content returns the current balance and moves nothing; with different content
   it is `DUPLICATE_TRANSACTION`. The ledger key is `game:<id>` as a second line of defence.
2. **Per-id advisory lock** (`pg_advisory_xact_lock`): a bet and its rollback take the same key,
   so they never interleave.
3. **Bets** need a live (unexpired) session and an `active` player. Insufficient balance is
   `INSUFFICIENT_FUNDS` (402) and nothing is recorded.
4. **Wins and rollbacks settle on expired sessions**: the bet was taken while it was valid.
   A win of 0 closes a lost round without a ledger transaction.
5. **Rollbacks**: refund the bet once (a second rollback of the same bet is a no-op). A rollback
   of a bet we never saw is stored as a tombstone, and that bet is refused if it arrives later
   (`TRANSACTION_ROLLED_BACK`). Only bets can be rolled back.
6. A closed round (`win` with `roundClosed`, the default) takes no more bets or wins.
7. Activity is published after commit; a failed publish is logged and never undoes the bet.
   A rolled-back bet is not taken back from promotions (known gap).

## Endpoints

All `POST /api/game-wallet/{balance|bet|win|rollback}`, signature required, `200 { balance,
currency }`. No player session: the session token in the body identifies the player.

## Producers today

Our own game servers call this API over real HTTP through `GameWalletClient`
(`src/common/game-wallet/`), exactly like an external provider: the mock studio
(`casino/aggregator/mock/mock-game-server.ts`) and Metrobet Originals (`modules/originals`). **When a real aggregator
is signed:** add a controller adapter for its protocol (auth, field names, error codes) that calls
`GameWalletService`; keep these rules. Also restrict the route to the aggregator's IPs.

## Not yet

Reconciliation of open rounds (wins the provider never delivered), free-spin rewards through the
provider API (promo rewards stay `granted`), responsible-gaming limits on bets, live balance push
over WebSocket.
