# Casino module (api)

Game catalogue, slots lobby, search and game launch. Games come from one **aggregator** (not
chosen yet: Slotegrator / SoftSwiss / Hub88…) behind the `GameAggregator` port. Players see the
catalogue as **Slots** (slot games only); crash games are listed on the Crash page.

## Adapters (`CASINO_AGGREGATOR`)

| Value            | What                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock` (default) | `MockGameAggregator`: fictional studios, generated art, our own demo page                                                                                                                                                                                                                                                   |
| `public-demos`   | `PublicDemoAggregator`: real slots from providers' **free public demos**: Pragmatic Play (40, `demogamesfree.pragmaticplay.net`) and BGaming (22, `demo.bgaming-network.com`), plus mock crash/table games and the mock **Golden Fleece** slots (real money). **Development only**: env validation refuses it in production |

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
| POST   | `/api/casino/games/:slug/launch`                                | `{ url }`; body `{ mode: 'demo', locale }` (`real` → 400)          |
| POST   | `/api/casino/games/:slug/sessions`                              | **Player auth.** Real money: opens a game session, `{ url }`       |
| GET    | `/api/casino/providers?type`                                    | `Provider[]` with game counts                                      |

## Real money

- `hasRealMoney` (aggregator-owned, synced; in `GameDetail`): the provider settles this game
  through our game wallet API. Mock slots: yes. Public demos: never.
- `POST games/:slug/sessions` checks the game and that the player is `active`, then
  `GameSessions.open` stores a session (SHA-256 of a random token, 6 h TTL, table
  `casino_game_sessions`) and the aggregator builds the launch URL with the raw token. The
  provider sends that token back in every game wallet call (`modules/game-wallet`).
- `GameSessions` is exported for the game wallet module: game sessions belong to the casino
  (launching), money to the game wallet.

## Catalogue sources

`GameAggregator` is bound to a `CombinedAggregator`: the adapter picked by `CASINO_AGGREGATOR`
plus first-party sources that are always on (today: **Metrobet Originals**, `modules/originals`).
Catalogues are merged; a launch goes to the source that `owns()` the game id (`originals:*`).

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
  servers: generated SVG thumbnails (strict CSP) and a playable game page (slot or crash, in
  ka/en/ru) that only allows framing by our sites (`frame-ancestors` = `CORS_ORIGINS`).
- **Real money (slots):** the page (`?mode=real&session=…`) calls the studio's game server
  (`play/:id/balance`, `play/:id/spin`). `MockGameServer` decides the outcome
  (`mock-slot-math.ts`: CSPRNG reels, ≈ 95.4 % RTP, bets 1–50 ₾) and settles it through the
  signed game wallet API over HTTP (`GameWalletClient` → `API_PUBLIC_URL/api/game-wallet`):
  bet, then win (0 closes a lost round, retried with the same id); a bet with an unknown
  outcome is rolled back. The page posts `{ type: 'metrobet:balance', balance }` to the site
  (`WEB_URL` origin) after each spin so the header balance follows.
- **When the real aggregator arrives:** implement `GameAggregator` (catalogue, launch, later the
  seamless-wallet callbacks), switch the binding in `casino.module.ts`, delete the mock
  controller, and add the provider image host to the web `images.remotePatterns`.
