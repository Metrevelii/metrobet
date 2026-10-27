# Promotions module (api)

The **promo engine**: promo banners plus promotion pages built from blocks, and player opt-in.
Managed from the backoffice. Promotions are data, never per-promo code: a new kind of content is
a new block type (see "Adding a block type" in `apps/web/src/features/promotions/CLAUDE.md`).

## Endpoints

Public:

| Method | Path                                       | Returns                  |
| ------ | ------------------------------------------ | ------------------------ |
| GET    | `/api/promotions?locale=ka&placement=home` | `PromotionCard[]`        |
| GET    | `/api/promotions/:slug?locale=ka`          | `PromotionDetail` or 404 |
| GET    | `/api/promotions/:slug/enrollment`         | `PromotionEnrollment`    |
| POST   | `/api/promotions/:slug/enrollment`         | `PromotionEnrollment`    |

The enrollment routes need a player session (`PlayerAuthGuard`) and a **live** promotion (404
otherwise). POST is idempotent (200, keeps the first date) and answers 400 when the promotion has
no opt-in block.

Admin (staff session, roles `admin`/`marketing`), all bodies validated with contracts schemas:

| Method | Path                               | Body             | Notes                            |
| ------ | ---------------------------------- | ---------------- | -------------------------------- |
| GET    | `/api/admin/promotions`            |                  | every status, display order      |
| GET    | `/api/admin/promotions/:id`        |                  | 404 if missing                   |
| POST   | `/api/admin/promotions`            | `PromotionInput` | appended last; 409 on taken slug |
| PUT    | `/api/admin/promotions/:id`        | `PromotionInput` | full replace                     |
| PATCH  | `/api/admin/promotions/:id/active` | `{ isActive }`   |                                  |
| PUT    | `/api/admin/promotions/order`      | `{ ids }`        | must list every id exactly once  |
| DELETE | `/api/admin/promotions/:id`        |                  | 204                              |

Wheel (player session; 404 unless live and the block is a wheel):

| Method | Path                                         | Returns                       |
| ------ | -------------------------------------------- | ----------------------------- |
| GET    | `/api/promotions/:slug/wheels/:blockId`      | `WheelState`                  |
| POST   | `/api/promotions/:slug/wheels/:blockId/spin` | `WheelSpinResult` · 403 · 409 |

## Engine: mechanics (`engine/`, `mechanics/`)

Interactive blocks are **mechanic plugins** (`PromoMechanic`, registered in `PROMO_MECHANICS` in
`promotions.module.ts`). `PromoActivityService` subscribes to the activity bus and, for every
promotion **live at the event's time** whose page has a block with a mechanic, and that the player
may take part in (`PromoEligibility`: opted in **before** the event, when the page has opt-in),
calls `mechanic.onActivity({ promotion, block, event })`. Mechanics never re-check those rules.

**Wheel** (`mechanics/wheel/`):

- Progress is stored as **amount wagered** (`promo_wheel_progress`, minor units) plus spins used,
  never as spins: `spinsAvailable = floor(wagered / stepAmount) - spinsUsed` (`wheel-math.ts`),
  so editing the step later stays fair. Only bets on `earn.gameTypes` count.
- `spin`: one transaction with `SELECT … FOR UPDATE` on the progress row (concurrent spins can't
  overspend), weighted pick with `crypto.randomInt`, then `promo_wheel_spins` + `promo_rewards`.
  Weights never leave the API (the view has only `freeSpins` per segment).
- Admin save checks every wheel's `freeSpinsGame` is an existing **slot** (`CasinoService`).

**Rewards** (`rewards.schema.ts`): `promo_rewards` holds every win (`source` + unique `sourceId`,
kind `freeSpins`, payload `{ count, gameSlug }`), status `granted`. Crediting (aggregator
free-spins API / wallet) will flip them to `credited`; no promo code changes.

**Adding a mechanic:** block type in contracts (schema + view without secrets) → a class
implementing `PromoMechanic` (+ its own tables in `mechanics/<name>/`) → add it to
`PROMO_MECHANICS` → player endpoints if it has actions → web renderer + backoffice editor.

## Rules

- Status is derived, never stored: `getPromotionStatus()` from contracts (`inactive` /
  `scheduled` / `expired` / `live`). Public endpoints only ever return `live` promotions.
- Lists are sorted by `sortOrder`; reorder rewrites it in steps of 10 inside one transaction.
- **Page = `blocks`** (`PromoBlock[]`, `packages/contracts/src/promotions/blocks.ts`), stored as
  one `jsonb` column and validated by `promotionInputSchema`: unique block ids, at most one
  `optIn`, a `countdown` needs `endsAt`, max 30 blocks.
- **Opt-in is derived:** `requiresOptIn(blocks)` = the page has an `optIn` block. No flag column.
- Localization happens here: `LocalizedText` (`{ ka, en, ru }`, all required) is resolved for
  the requested locale. The site never receives other languages.
- Every admin mutation (`AdminPromotionsService`): audit entry `promotion.<action>` with
  before/after, then revalidates the site's `promotions` cache tag.

## Storage

Table `promotions` (`promotions.schema.ts`): localized fields and `blocks` are `jsonb`,
`placements` is `text[]`, `category` is the `promotion_category` enum, schedule columns are
`timestamptz`. `promotion_enrollments` (PK promotion + player, both cascade on delete) records
opt-ins. Migration 0005 converted the old `content`/`terms` columns into `richText` + `terms`
blocks.
`PromotionsRepository` (abstract class = DI token) → `DrizzlePromotionsRepository`. Unique slug
violations become `PromotionSlugTakenError` → HTTP 409.

Known gap: the audit insert is not in the same transaction as the change. Fine for now; revisit
when we add a transaction helper (wallet will need one anyway).

## Seed

`pnpm --filter @metrobet/api db:seed` inserts `promotions.seed.ts` (idempotent by slug: existing rows are not updated). `slots-tournament`
is the showcase page using every content block type; `wheel-of-fortune` (opt-in + wheel, 50 ₾ on
slots = 1 spin) uses the first slot of the synced catalogue, so the seed syncs the casino first. The seed
images are site-relative paths served by `apps/web/public`.
