# Casino module (api)

Game catalogue, lobby, search and game launch. Games come from one **aggregator** (not chosen
yet: Slotegrator / SoftSwiss / Hub88…) behind the `GameAggregator` port. Today it's bound to
`MockGameAggregator`.

## Endpoints (public)

| Method | Path                                                       | Returns                                      |
| ------ | ---------------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/casino/lobby`                                        | `CasinoLobby` (row per category + providers) |
| GET    | `/api/casino/games?category&provider&search&page&pageSize` | `GamePage`                                   |
| GET    | `/api/casino/games/:slug`                                  | `GameDetail`                                 |
| POST   | `/api/casino/games/:slug/launch`                           | `{ url }`; body `{ mode, locale }`           |
| GET    | `/api/casino/providers`                                    | `Provider[]` with game counts                |

`mode: 'real'` returns 401 until player auth + wallet exist (roadmap step 7).

## Data flow

```
aggregator ──sync (CasinoSyncService)──▶ casino_providers / casino_games ──CasinoCatalog──▶ API
```

- **Sync** upserts by `externalId`. Aggregator-owned fields are refreshed; our curation fields
  (`isActive`, `slug`) are kept. Runs in `db:seed`; later a scheduled job + backoffice button.
- **Categories are rules, not data** (`CATEGORY_RULES` in `casino.catalog.ts`): popular = by
  popularity, new/jackpots = by tag, slots/table/crash = by type. Lobby and listings both use
  them. Add a category: contracts `CASINO_CATEGORIES` + a rule + web translations.
- Only active games of active providers are ever visible (one `where()` helper).
- Search is `ILIKE` with LIKE wildcards escaped. Fine for a few thousand games; move to
  `pg_trgm` / full-text when the real catalogue lands.

## Mock aggregator (`aggregator/mock/`)

- `mock-catalog.ts`: 10 fictional studios, 78 games, deterministic tags/popularity/RTP.
- `MockAggregatorController` (`/api/casino/mock/*`) stands in for the aggregator's CDN and game
  servers: generated SVG thumbnails (strict CSP) and a playable demo page (slot or crash, in
  ka/en/ru) that only allows framing by our sites (`frame-ancestors` = `CORS_ORIGINS`).
- **When the real aggregator arrives:** implement `GameAggregator` (catalogue, launch, later the
  seamless-wallet callbacks), switch the binding in `casino.module.ts`, delete the mock
  controller, and add the provider image host to the web `images.remotePatterns`.
