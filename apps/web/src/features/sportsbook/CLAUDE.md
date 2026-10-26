# Sportsbook (web)

Pages (in the `(sportsbook)` route group, which also renders the betslip):
`/sports` → `/sports/football`, `/sports/[sport]` (live + upcoming by competition),
`/sports/[sport]/[event]` (all markets), `/live` (all live), home "Live now".

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
- Each item keeps the odds the player accepted. If the live price differs, the slip shows
  old → new and requires "Accept odds changes"; suspended selections block placing.
- Placing bets is disabled until player auth + wallet (roadmap step 7).
