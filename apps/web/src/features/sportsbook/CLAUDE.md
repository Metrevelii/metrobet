# Sportsbook (web)

Pages (in the `(sportsbook)` route group, which also renders the betslip):
`/sports` → `/sports/football`, `/sports/[sport]` (live + upcoming by competition),
`/sports/[sport]/[event]` (all markets), `/live` (all live), home "Live now", `/bets` (my
tickets: Open / Settled tabs as `?status=`, paged; signed-out → log in).

## Data & real time

- `data.ts` (server): request-time snapshots (`connection()` + uncached fetch). Render inside
  `<Suspense>`.
- `<LiveEvents eventIds refreshOnLiveChange? />`: put it on every page that shows events. It
  subscribes over Socket.IO (`realtime/socket.ts`: one shared connection, ref-counted rooms,
  resubscribe on reconnect) and, optionally, refreshes the page when matches go live/finish.
- `realtime/live-store.ts`: per-key external store (`selection:<id>`, `event:<id>`). Components
  read one key (`useSelectionLiveState`, `useEventLiveState`), so a price change re-renders only
  its button. The server snapshot is the fallback until the first update.
- Env: `NEXT_PUBLIC_API_WS_URL` (api origin for the browser).

## Components

| Component                      | Notes                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `OddsButton`                   | Live price, ▲/▼ flash (`animate-flash`, re-keyed per change), lock when not bettable, toggles betslip |
| `EventRow`                     | Time/clock, teams + score, headline market, "+N" link                                                 |
| `CompetitionBlock`             | Card per competition                                                                                  |
| `EventHeader`                  | Scoreboard (score, period, clock, period scores)                                                      |
| `MarketCard`                   | One market with labelled selections                                                                   |
| `SportTabs`                    | Live + sport chips with counts                                                                        |
| `BetslipRail` / `BetslipSheet` | Desktop column (xl) / floating button + bottom sheet (below xl)                                       |

Labels: `labels.ts` builds market/selection/period labels from translations (`Sports.*`).
Short labels (1/X/2) in lists, team names on the event page and betslip.

## Betslip (`betslip/`)

- Persisted in localStorage (`store.ts`), external store with `useBetslip` / `useInBetslip`.
- One selection per market (picking another replaces it); the second event switches to
  accumulator; accumulator rejects two selections from the same event.
- **Layout** (modelled on Crystalbet): header tabs Betslip (count) / My bets + clear (bin);
  Accumulator / Singles underline tabs; numbered selections (match bold, market, pick in the
  accent colour, odds pill, ×); total odds; one stake row with **ALL** (whole balance, via the
  `currentBalance` action) / − / + / amount in ₾; big potential win; two preferences; a large
  "Place ticket" button. Same component in the desktop rail and the mobile sheet.
- **One stake** (`store.stake`, ₾): the accumulator's stake, or the stake of each single.
- Each item keeps the odds the player accepted. Live price moves: lower always needs "Accept
  odds changes"; higher is placed directly when **Accept higher odds** is on (default);
  **Accept any odds changes** places at the live price without asking. Both preferences are
  saved with the slip. Suspended selections block placing.
- **Placing** (`bets/actions.ts` `placeBets`): sends the odds each item was accepted at, stakes
  in minor units (`toMinor`), a fresh `idempotencyKey` per click. The API re-prices (lower odds →
  `ODDS_CHANGED`, higher taken automatically), applies a 3 s live delay, limits and the wallet
  debit (rules: `apps/api/src/modules/betting/CLAUDE.md`). On success the slip is cleared, a
  "placed" panel links to `/bets`, the header balance updates (`setLiveBalance`). Errors map to
  `Betslip.errors.*` (insufficient funds links to `/wallet`).
- `bets/`: `TicketCard` (selections with ✓/✗/– results, stake, odds, potential win or payout),
  `MyBets` (tabs, paging), `data.ts` `getTickets` (request-time).
