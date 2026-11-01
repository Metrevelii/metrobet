# Sportsbook module (api)

Sports, events, markets and live odds. Data comes from an **odds feed** behind the `OddsFeed`
port. Today it's the built-in `SimulatedOddsFeed`; a licensed feed (Betradar UOF, Genius,
OddsMatrix…) replaces it in production.

## Flow

```
OddsFeed ──upsert/remove(EventDetail)──▶ SportsbookStore ──diff──▶ SportsbookGateway (Socket.IO)
                                               └──▶ SportsbookController (REST snapshots)
```

- **Store** (`sportsbook.store.ts`): in-memory current state. Every upsert is diffed: only changed
  markets are emitted (`update`); markets that disappear are emitted once as `closed`. Live-set
  changes are coalesced into one `live-changed` per tick. Move to Redis (+ Socket.IO Redis
  adapter) before running more than one API instance.
- **REST** (`/api/sportsbook/*`): `sports`, `sports/:sport` (live + next 48 h by competition;
  `?day=all|today|tomorrow|soon` in Tbilisi days, `today` keeps live matches; `?competitions=id,id`),
  `sports/:sport/competitions` (leagues with live/upcoming counts), `live`, `events/:id`. Used
  for first render. Every `EventSummary` carries its match-table `markets` (`tableMarkets`: one
  per `TABLE_COLUMNS` group, the most balanced open line for totals/handicaps).
- **Socket.IO** namespace `/sportsbook`: client `subscribe { eventIds }` → ack with each event's
  current state (closes the gap between the REST snapshot and the first update); then `update`
  messages per subscribed event; `live-changed` broadcast. Message names in contracts
  (`SPORTSBOOK_WS`). CORS comes from `CORS_ORIGINS` (`CorsIoAdapter`).

## Domain rules (contracts `sportsbook.ts`)

- Ids: market `${eventId}:${type}:${line|-}`, selection `${marketId}:${key}`, stable over time.
- Market status: `open` · `suspended` (bet stop, e.g. a few seconds after a goal) · `closed`
  (outcome decided or event ended). A selection is `active: false` when it can't be bet.
- Odds are decimal with 2 decimals, margin 6% (`pricing.ts`), clamped to 1.01–100.
- No display text from the API: clients localize market/selection labels from type/line/key.

## Simulated feed (`feed/simulated/`)

- **Deterministic:** fixtures per 15-min slot and every match timeline (goals, points, games) come
  from seeded RNG, so the state is a pure function of time. Restarts and multiple instances agree.
- **Schedule:** each competition plays a round every `cadenceSlots` (football 2 h, basketball
  1.5 h, tennis 3.5 h, eSoccer every 15 min) with distinct teams, so no team overlaps itself.
  48 h horizon.
- **Models:** football = Poisson goals with a `FootballSchedule` (real minutes per half, break,
  bet stop after goals, goals factor): 1X2, double chance, totals 1.5/2.5/3.5, BTTS, half-time
  result (closed at HT), handicap ±1.5, team totals 0.5/1.5, correct score 0–0…3–3 + other.
  **eSoccer** = the same model on `ESOCCER_SCHEDULE` (2 × 4 min + 1 min break, ×1.45 goals,
  3 match-minute bet stop), so it has every football market. Basketball = per-minute scoring,
  normal approximation (moneyline, spread, total); tennis = game-by-game best of 3 with exact
  recursion (winner, current set).
- **Match tracker** (football, eSoccer): `LiveState.stats` (possession, shots, on target,
  corners, cards) and `incidents` (goals, yellow/red cards with minute and team), drawn from the
  same seed _after_ the goals, so results never changed. Only `events/:id` and socket updates
  carry them; `toSummary` strips them so lists stay small.
- Prices drift every 20 s live / 10 min pre-match so odds move like a real feed.
- `SPORTSBOOK_FEED=off` disables it.

## Trading (`trading/`, backoffice controls)

```
feed ──▶ SportsbookStore.upsert(raw) ──TradingRules.apply──▶ what players see (REST, socket, bets)
backoffice ──▶ TradingService (DB + audit) ──▶ TradingRules ──onChange──▶ store re-applies at once
```

- **Suspensions** (`trading_suspensions`): a whole event or one market. Open markets become
  `suspended` with inactive selections, so new bets, betslips and cash-out stop at once. Kept
  until resumed (survive restarts; the feed can't reopen them).
- **Rules** (`trading_rules`) per sport or competition: `margin` (percent; the feed's price is
  normalised and re-margined, `remargin()`), `maxStake`, `maxPayout`. Field by field:
  competition → sport → feed price / `BET_LIMITS`. Combos get the strictest limits of their legs
  (`TradingRules.limitsFor`, used by betting).
- The store keeps both the feed's events (`feedEvent`) and the effective ones; staff screens show
  both prices. `TradingRules` is pure and in memory: with several API instances, broadcast
  changes (Redis) like the store itself.
- Admin API `/api/admin/sportsbook/*` (risk; audit-logged as `sportsbook.suspend|resume|rule.*`):
  `GET events?sport&status=live|scheduled|suspended&q&page`, `GET events/:id` (event, feed odds,
  suspensions with staff names, effective margin/limits), `POST suspensions`,
  `POST suspensions/resume` (`{ scope, targetId, reason }`), `GET|PUT rules`,
  `DELETE rules/:scope/:key`, `GET targets` (competitions in the feed).

## Replacing with a real feed

Implement `OddsFeed` (connect, map provider messages to `EventDetail`, handle bet stops, and
`result(eventId)` from the provider's results/settlement API), bind it in
`sportsbook.module.ts`. Keep ids stable.

## Used by betting (`modules/betting`)

The module exports `SportsbookStore` (`findSelection(id)` prices bets) and `OddsFeed`
(`result(eventId)`: final `LiveState` of a finished event, null before). The simulated feed
recomputes any match from its id, so results are available long after it left the lists.
