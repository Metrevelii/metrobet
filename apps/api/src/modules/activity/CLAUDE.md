# Activity module (api)

The **activity bus**: player actions (today: casino bets) that other modules react to. Promotions
subscribe to it for wager progress; later leaderboards, missions, risk and loyalty will too.

## Flow

```
producer ──publish(event)──▶ ActivityBus ──insert activity_events (PK = event id)──▶ subscribers
```

- Events are `ActivityEvent` from contracts (`casino.bet`: player, amount in minor units, game
  slug and type). Producer-unique `id`s (the aggregator's transaction id) make publishing
  **idempotent**: a re-delivered event returns `false` and reaches no subscriber.
- Subscribers run in-process, one after another; a failing one is logged and skipped. Not
  transactional with the log: if a subscriber fails, its work is lost for that event. When this
  matters (scale-out, real money), deliver from `activity_events` through a queue (BullMQ).
- `activity_events` is append-only and kept for replays (e.g. recomputing a leaderboard).

## Producers

| Producer                                | When                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/dev/activity/casino-bet`     | **Dev only** (404 in production). Body `{ gameSlug, amount }`, player session required. Fakes a bet (no money moves) |
| Game wallet API (`modules/game-wallet`) | Every real-money bet, after commit, id `game:<provider transaction id>`                                              |

Subscribe with `bus.subscribe(handler)` in `onModuleInit` (see `PromoActivityService`).
