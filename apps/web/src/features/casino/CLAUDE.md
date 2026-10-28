# Casino (web)

Shown to players as **Slots** (slot games only), organised like adjarabet:

- **Provider tabs** (`ProviderTabs`): "All" (`/slots`) + one tab per provider that has slots
  (`/slots/providers/[provider]`), with game counts, biggest catalogue first. Built from the
  catalogue, so a newly synced provider (e.g. EGT via the aggregator) gets a tab automatically.
- **Category chips** inside the current tab: Popular (default) / New / Jackpots as `?category=`
  (`slotsHref({ provider, category })`), plus Favorites (`/slots/favorites`, all providers).
- Search (`/slots/search?q=`), launcher (`/slots/play/[game]`). Old `/casino/*` and
  `/slots/<category>` URLs redirect (next.config).

The `/crash` page (`type: 'crash'`) and the home "Popular games" row reuse the feature. Slot pages
always pass `type: 'slot'` to listings.

## Data

- `data.ts` (server): `getLobby`, `getGames`, `getProviders`, `getGame` are `'use cache'` with
  tag `casino`. They return empty/null on outages (short `cacheLife`), so **render them inside
  `<Suspense>`**. `launchGame` is never cached: one provider session per visit.
- `actions.ts`: `loadMoreGames` Server Action for "Load more" (re-validates the query).
- `game-lists.ts` (client): favorites (100) and recently played (12) in localStorage via
  `useSyncExternalStore`; returns `null` before hydration. Stores whole `GameCard`s so lists need
  no API call. Moves to the player account after auth.

## Components

| Component                | Notes                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| `CasinoPage`             | Frame: optional top block, toolbar (search, provider select, chips), title       |
| `GameTile`               | square art, tag badges, favorite (sibling of the link, not nested), play overlay |
| `GameGrid` / `GAME_GRID` | Columns by **container** width (`@container`), not viewport                      |
| `GameRow`                | Carousel row with header, "View all", arrows                                     |
| `GamesListing`           | Count + `LoadMoreGrid` for any query; handles empty / outage states              |
| `GameFrame`              | Launcher: toolbar (back, favorite, full screen) + sandboxed iframe               |

## Launcher rules

- iframe `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"`:
  game clients are cross-origin and need storage; top navigation stays blocked.
- Opening a game records it in "Recently played".
- **Real money** when the game has `hasRealMoney` and the player is signed in (default;
  `?mode=demo` opts out): `openRealSession(slug, locale)` opens a game session for the player.
  Otherwise `launchGame(slug, 'demo', locale)`. `ModeSwitch` in the toolbar links between the
  two (signed-out players are sent to log in first).
- **Metrobet Originals** launch URLs (`parseOriginalLaunch`) render the native client
  (`features/originals`) in the stage instead of an iframe.
- In real mode `GameFrame` accepts `{ type: 'metrobet:balance', balance }` messages **only from
  the game iframe's own origin and window**, Zod-checks them and calls `setLiveBalance` (wallet
  feature), so the header follows without reloading the page (a refresh would reload the game).

## Thumbnails

Square tiles. `next/image` with `unoptimized` for SVG (mock art); raster art is optimized and
its host must be in `images.remotePatterns` (`common-static.ppgames.net` is allowed for the dev
Pragmatic demo adapter; add the contracted aggregator's CDN when it lands).
