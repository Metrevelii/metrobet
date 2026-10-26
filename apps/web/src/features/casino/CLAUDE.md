# Casino (web)

Lobby (`/casino`), categories (`/casino/[category]`), providers (`/casino/providers/[provider]`),
search (`/casino/search?q=`), favorites (`/casino/favorites`), game launcher
(`/casino/play/[game]`). The `/crash` page and the home "Popular games" row reuse it.

## Data

- `data.ts` (server): `getLobby`, `getGames`, `getProviders`, `getGame` are `'use cache'` with
  tag `casino`. They return empty/null on outages (short `cacheLife`), so **render them inside
  `<Suspense>`**. `launchGame` is never cached: one provider session per visit.
- `actions.ts`: `loadMoreGames` Server Action for "Load more" (re-validates the query).
- `game-lists.ts` (client): favorites (100) and recently played (12) in localStorage via
  `useSyncExternalStore`; returns `null` before hydration. Stores whole `GameCard`s so lists need
  no API call. Moves to the player account after auth.

## Components

| Component                | Notes                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| `CasinoPage`             | Frame: optional top block, toolbar (search, provider select, chips), title    |
| `GameTile`               | 3:4 art, tag badges, favorite (sibling of the link, not nested), play overlay |
| `GameGrid` / `GAME_GRID` | Columns by **container** width (`@container`), not viewport                   |
| `GameRow`                | Carousel row with header, "View all", arrows                                  |
| `GamesListing`           | Count + `LoadMoreGrid` for any query; handles empty / outage states           |
| `GameFrame`              | Launcher: toolbar (back, favorite, full screen) + sandboxed iframe            |

## Launcher rules

- iframe `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"`:
  game clients are cross-origin and need storage; top navigation stays blocked.
- Opening a game records it in "Recently played".
- Demo only for now (`launchGame(slug, 'demo', locale)`); real money comes with auth/wallet.

## Thumbnails

`next/image` with `unoptimized` for SVG (mock art). Real aggregator art is raster: add its host
to `images.remotePatterns` in `next.config.ts`.
