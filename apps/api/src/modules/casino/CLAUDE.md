# Casino module (api)

Game catalogue, slots lobby, search and game launch. Games come from one **aggregator** (not
chosen yet: Slotegrator / SoftSwiss / Hub88…) behind the `GameAggregator` port. Players see the
catalogue as **Slots** (slot games only); crash games are listed on the Crash page.

## Adapters (`CASINO_AGGREGATOR`)

| Value            | What                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock` (default) | `MockGameAggregator`: fictional studios, generated art, our own demo page                                                                                                                                                                                                 |
| `public-demos`   | `PublicDemoAggregator`: real slots from providers' **free public demos**: Pragmatic Play (40, `demogamesfree.pragmaticplay.net`) and BGaming (22, `demo.bgaming-network.com`), plus mock crash/table games. **Development only**: env validation refuses it in production |

Showing a provider's games publicly requires an agreement (in Georgia, certified content via a
licensed supplier). Production must use the contracted aggregator, which also provides official
demo mode. After switching the value: restart the API and run `db:seed` (re-syncs the catalogue
and refreshes the site cache).

**Adding a demo provider** (`aggregator/public-demos/`): create a `DemoSource` (provider id, a
never-changing `idPrefix`, games, `launchUrl`), add it to `DEMO_SOURCES`, allow its cover host in
the web `images.remotePatterns`. Verify every game code against the provider's own demo launcher;
games without an official cover get generated art (`/api/casino/mock/art/:title.svg`). Checked
and not usable (Oct 2026): EGT/Amusnet (demos disabled on their own site), Evoplay, Playson,
Endorphina; Hacksaw needs their JS launcher + partner config.

## Endpoints (public)

| Method | Path                                                            | Returns                                                            |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/casino/lobby`                                             | `CasinoLobby`: slots only, row per category + providers with slots |
| GET    | `/api/casino/games?type&category&provider&search&page&pageSize` | `GamePage`                                                         |
| GET    | `/api/casino/games/:slug`                                       | `GameDetail`                                                       |
| POST   | `/api/casino/games/:slug/launch`                                | `{ url }`; body `{ mode, locale }`                                 |
| GET    | `/api/casino/providers?type`                                    | `Provider[]` with game counts                                      |

`mode: 'real'` returns 401 until player auth + wallet exist (roadmap step 7).

## Data flow

```
aggregator ──sync (CasinoSyncService)──▶ casino_providers / casino_games ──CasinoCatalog──▶ API
```

- **Sync** upserts by `externalId`. Aggregator-owned fields are refreshed; our curation fields
  (`isActive`, `slug`) are kept. Games/providers missing from the feed get `isAvailable = false`
  (aggregator-owned), so switching adapters hides old games without losing curation. Visible =
  `isActive AND isAvailable`. After a sync the site's `casino` cache tag is revalidated. Runs in
  `db:seed`; later a scheduled job + backoffice button.
- **Categories are rules, not data** (`CATEGORY_RULES` in `casino.catalog.ts`): popular = by
  popularity, new/jackpots = by tag. Game kind is the separate `type` filter (slot/crash/table).
  Add a category: contracts `CASINO_CATEGORIES` + a rule + web translations.
- Only active + available games of active + available providers are visible (one `where()`).
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
