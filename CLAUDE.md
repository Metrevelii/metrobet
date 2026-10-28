# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. Every big app, package and
feature has its own `CLAUDE.md` next to its code; Claude Code loads those automatically when
working in that directory. Keep this file about repo-wide rules; put details in the nested ones.

## Project

**Metrobet**: an online betting platform for the Georgian market (similar in scope to adjarabet.com).

- **Sportsbook**: pre-match and live betting. **Our own UI and bet engine** on top of a
  third-party odds feed (Sportradar / Genius / OddsMatrix, not chosen yet). No turnkey sportsbook.
- **Casino**: slots from many providers via one game **aggregator** (seamless-wallet API).
- **Crash games**: Aviator-style games, integrated like casino games.
- **Backoffice**: staff tool for players, bets, risk, odds/margins, games/providers, audit log.

Languages: **ka** (default), **en**, **ru**. Currency: **GEL** only for now.

## Stack

| Layer         | Choice                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Monorepo      | pnpm 12 workspaces + Turborepo, pnpm **catalog** for shared versions    |
| Language      | TypeScript (strict) everywhere, pinned to **~6.0** (see Gotchas)        |
| Player web    | Next.js 16 (App Router, Cache Components), React 19, next-intl          |
| Backoffice    | Next.js 16, same design system                                          |
| UI            | Tailwind CSS v4 + Radix (`radix-ui`) + cva, shadcn/ui-compatible tokens |
| API           | NestJS 12 (ESM) modular monolith                                        |
| Database      | PostgreSQL 17 + Drizzle ORM                                             |
| Cache / queue | Redis 8 (odds snapshot, pub/sub, sessions, BullMQ). Not wired yet       |
| Validation    | Zod 4: shared request/response/socket schemas live in `contracts`       |
| Tooling       | oxlint, Prettier (+ tailwind class sorting), Vitest                     |

## Repo map

```
apps/
  web/          @metrobet/web         player site, port 3000      → apps/web/CLAUDE.md
  backoffice/   @metrobet/backoffice  staff tool, port 3001       → apps/backoffice/CLAUDE.md
  api/          @metrobet/api         NestJS HTTP/WS, port 4000   → apps/api/CLAUDE.md
packages/
  ui/           @metrobet/ui          design system + themes      → packages/ui/CLAUDE.md
  contracts/    @metrobet/contracts   Zod schemas + types (FE↔BE) → packages/contracts/CLAUDE.md
  tsconfig/     @metrobet/tsconfig    base / library / nextjs / nestjs / react-library presets
```

## Commands

Requires **Node 24** (`nvm use`, see `.nvmrc`) and pnpm via corepack (`corepack enable`).

```bash
pnpm install
docker compose up -d        # postgres + redis (OrbStack/Docker)
# env files (gitignored; copy from the .env.example next to each):
#   apps/api/.env, apps/web/.env.local, apps/backoffice/.env.local
#   shared secret must match: WEB_REVALIDATE_SECRET (api) = REVALIDATE_SECRET (web)
pnpm --filter @metrobet/api db:migrate   # apply SQL migrations
pnpm --filter @metrobet/api db:seed      # demo promotions, casino sync, dev admin (idempotent)
# backoffice login: admin@metrobet.local / SEED_ADMIN_PASSWORD from apps/api/.env
# more staff: STAFF_EMAIL=… STAFF_NAME=… STAFF_ROLE=marketing STAFF_PASSWORD=… pnpm --filter @metrobet/api staff:create
# dev codes (verification, password reset): API log or GET http://localhost:4000/api/dev/outbox
# real money in dev: sign in, /wallet → test deposit, then play a Golden Fleece slot

pnpm dev                    # all apps (turbo builds contracts first)
pnpm --filter @metrobet/web dev
pnpm build | pnpm typecheck | pnpm test
pnpm --filter @metrobet/api test:e2e   # real Postgres, own `metrobet_test` database
pnpm lint                   # oxlint, whole repo, one root config (.oxlintrc.json)
pnpm format                 # prettier, whole repo
pnpm check                  # lint + format:check + typecheck + test: run before committing
```

Add a dependency to one package: `pnpm --filter @metrobet/<pkg> add <dep>`. If more than one
package uses it, add the version to `catalog:` in `pnpm-workspace.yaml` and reference it as
`"<dep>": "catalog:"`.

## Engineering principles

1. **DRY by placement.** Decide where code lives before writing it:
   - Generic, design-level UI (button, card, dialog, tabs, table) → `packages/ui`.
   - Anything both frontend and backend must agree on (schemas, enums, DTO types, socket
     event names, constants like `LOCALES`) → `packages/contracts`. Never redeclare these.
   - Product-specific UI (odds button, bet slip, game tile) → `apps/web/src/features/<feature>/`.
   - Promote code to a package the second time it is needed, not before.
2. **Single source of truth** for config-like data: nav items, locales, routes, limits. Derive
   everything else from it (see `apps/web/src/config/navigation.ts`).
3. **Strict types, no `any`.** Parse untrusted input (HTTP bodies, sockets, env, provider
   callbacks) with Zod at the boundary; trust types inside.
4. **Small, composable units.** One component per file, named exports, kebab-case file names.
5. **Server-first** in Next.js: Server Components by default; `'use client'` only on the leaf
   that needs state, effects or browser APIs.
6. **Every user-facing string is translated**: add the key to all three files in
   `apps/web/src/messages/`.
7. **Money:** integer minor units (`bigint` / tetri), never floats;
   double-entry ledger; idempotency keys on every balance-changing call. Only the wallet's `Ledger.post`
   writes money (see `apps/api/src/modules/wallet/CLAUDE.md`).

## Design system: built to be replaced

The current look is **"Midnight Pro"** (dark navy, electric-lime primary). It is deliberately
isolated so it can be swapped later without touching components:

- Components use **semantic tokens only** (`bg-card`, `text-muted-foreground`, `bg-primary`,
  `text-odds-up`). Tailwind's default palette is disabled, so `bg-zinc-900` and the like do not
  exist. Never hard-code hex colors in components.
- The whole look lives in one theme file: `packages/ui/src/themes/midnight-pro.css`.
- **To change the design:** add a new theme file that defines the same `--mb-*` variables, then
  switch the import in `packages/ui/src/styles/index.css`. Details: `packages/ui/CLAUDE.md`.
- Dark/light is a separate axis (`data-mode` on `<html>`). Both modes are defined per theme.

## Conventions

- Commits: Conventional Commits, enforced by the `commit-msg` hook: `feat`, `fix`, `refactor`,
  `perf`, `chore`, `docs`, `test`, `ci`, `build`, `style`, `revert`, with an optional scope
  (`feat(casino): add game tile`).
- Git hooks (lefthook, `lefthook.yml`, installed by `pnpm install`): pre-commit runs Prettier and
  `oxlint --fix` on staged files and re-stages fixes.
- CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm build` on every push to `main` and
  on PRs. Keep `main` green.
- Workflow: commit straight to `main` (no feature branches/PRs for now).
- Imports: packages by name (`@metrobet/ui`), app code by alias (`@/…`), siblings relative.
- When you create a new feature module (web feature folder or Nest module), give it a short
  `CLAUDE.md`: purpose, data flow, invariants, gotchas. Add it to the index below.

## CLAUDE.md index

- `apps/web/CLAUDE.md`: player site, routing, i18n, layout shell
- `apps/backoffice/CLAUDE.md`: staff tool
- `apps/api/CLAUDE.md`: NestJS modules, database, config
- `packages/ui/CLAUDE.md`: design tokens, themes, component rules
- `packages/contracts/CLAUDE.md`: shared schemas
- `apps/web/src/features/promotions/CLAUDE.md`: promo slider, promotion pages
- `apps/api/src/modules/promotions/CLAUDE.md`: promotions API, admin endpoints, live/schedule rules,
  promo engine (mechanic plugins, wheel, rewards)
- `apps/api/src/modules/activity/CLAUDE.md`: activity bus (player bets → promotions), dev bet endpoint
- `apps/backoffice/src/features/promotions/CLAUDE.md`: promotions management screens
- `apps/api/src/modules/casino/CLAUDE.md`: game catalogue, aggregator port, mock aggregator
- `apps/web/src/features/casino/CLAUDE.md`: Slots lobby, listings, favorites, launcher
- `apps/api/src/modules/sportsbook/CLAUDE.md`: odds feed port, simulated feed, store, Socket.IO
- `apps/web/src/features/sportsbook/CLAUDE.md`: sports pages, live odds, betslip
- `apps/api/src/modules/auth/CLAUDE.md`: sessions, guards, roles, codes, rate limits
- `apps/api/src/modules/players/CLAUDE.md`: player accounts and auth endpoints
- `apps/web/src/features/auth/CLAUDE.md`: login/register/verify/reset pages
- `apps/api/src/modules/wallet/CLAUDE.md`: double-entry ledger, ledger invariants, wallet endpoints
- `apps/web/src/features/wallet/CLAUDE.md`: header balance, `/wallet` page, dev deposits
- `apps/api/src/modules/game-wallet/CLAUDE.md`: seamless wallet API for game providers (bet/win/rollback)
- `apps/api/src/modules/originals/CLAUDE.md`: in-house studio game server (Supra Fortune, Metro Jet)
- `apps/web/src/features/originals/CLAUDE.md`: native Originals game clients

## Roadmap

1. ✅ Monorepo scaffold, tooling, CLAUDE.md files
2. ✅ Design system foundation (tokens, Midnight Pro theme, primitives) + web/backoffice shells
   2a. ✅ Promotions: promo slider on home/section pages, `/promotions` list and detail pages
   2b. ✅ Postgres + Drizzle, audit log, media uploads, backoffice promotions management (list with
   drag-to-reorder/toggle/delete, editor with live preview), instant site revalidation
3. ✅ Slots (casino catalogue, slot games only): lobby, categories, providers, search,
   favorites/recent, launcher, provider tabs (All + one per provider). Mock aggregator by default;
   `CASINO_AGGREGATOR=public-demos` loads real Pragmatic Play + BGaming demo slots for **local
   development only**. Crash page lists crash games
4. ✅ Sportsbook: football/basketball/tennis, live matches and odds over Socket.IO, event pages,
   betslip (singles/accumulator, odds changes). Free deterministic simulated feed
5. 🟡 Promo engine (adjarabet-style promotions as data + plugins, not a branch per promo):
   ✅ page blocks (text, steps, countdown, prizes, FAQ, terms, opt-in) + backoffice page builder +
   player opt-in. ✅ activity bus + mechanic plugins + **prize wheel** (spins from wager
   checkpoints, free-spin rewards). ⏳ symbol collection, leaderboards, more instant-win skins,
   calendar/raffle/cashback, templates/clone, per-promo theme
6. 🟡 Crash games: ✅ Metro Jet (Metrobet Originals, see step 8) listed on the Crash page.
   ⏳ more crash titles, a dedicated crash lobby
7. ⏳ Backoffice screens (players, bets, games, sportsbook management, audit log)
8. 🟡 Auth ✅ (players: email or phone, 25+, code verification, password reset; staff accounts
   with roles replace the shared admin key). ✅ Wallet: double-entry ledger in tetri (idempotent,
   append-only, DB-enforced zero-sum), balance in header, `/wallet` history, dev test deposits.
   ✅ Game wallet API (signed bet/win/rollback, rounds, game sessions) + real-money mock slots
   (Golden Fleece) that settle through it; real bets feed promotions. ✅ **Metrobet Originals**
   (in-house studio): Supra Fortune slot (5×3, 96.27 %) and Metro Jet crash (shared live rounds,
   provably fair, 97 %), native clients over Socket.IO, real money + demo. ⏳ KYC, payments
   (TBC/BoG), real provider integrations

Until step 8, frontends run on **mock data and mock providers**. Keep mocks behind the same
interfaces the real integrations will use, so swapping them changes no UI code.

## Gotchas

- **Auth**: players and staff use opaque bearer sessions kept in httpOnly cookies by the web
  apps (never exposed to browser JS). Staff routes require `StaffAuthGuard` + `@Roles()`.
  See `apps/api/src/modules/auth/CLAUDE.md`.
- **TypeScript is pinned to ~6.0**: TS 7 (native) is out, but NestJS CLI 12 and
  typescript-eslint require < 6.1. Revisit when they support 7.
- **pnpm 12 blocks dependency build scripts** unless listed under `allowBuilds` in
  `pnpm-workspace.yaml`. Approve new ones with `pnpm approve-builds <pkg>`.
- **Next.js 16 differs from older versions**: `middleware.ts` is now `proxy.ts`; Cache
  Components are on (nothing is cached unless you use `'use cache'`; request-time data must sit
  inside `<Suspense>`); `next/root-params` provides the locale. Read the version-matched docs in
  `apps/web/node_modules/next/dist/docs/` before relying on memory.
- **`@metrobet/contracts` is consumed from `dist/`.** Turbo builds it before `dev`, `build`,
  `typecheck` and `test`. If you run an app directly and imports fail, run
  `pnpm --filter @metrobet/contracts build`.
- Node 24 is required: NestJS CLI 12 crashes on Node 22.
