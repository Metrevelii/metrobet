# Promotions module (api)

Promo banners and promotion pages for the player site, managed from the backoffice.

## Endpoints

Public:

| Method | Path                                       | Returns                  |
| ------ | ------------------------------------------ | ------------------------ |
| GET    | `/api/promotions?locale=ka&placement=home` | `PromotionCard[]`        |
| GET    | `/api/promotions/:slug?locale=ka`          | `PromotionDetail` or 404 |

Admin (`x-admin-key`, see `AdminKeyGuard`), all bodies validated with contracts schemas:

| Method | Path                               | Body             | Notes                            |
| ------ | ---------------------------------- | ---------------- | -------------------------------- |
| GET    | `/api/admin/promotions`            |                  | every status, display order      |
| GET    | `/api/admin/promotions/:id`        |                  | 404 if missing                   |
| POST   | `/api/admin/promotions`            | `PromotionInput` | appended last; 409 on taken slug |
| PUT    | `/api/admin/promotions/:id`        | `PromotionInput` | full replace                     |
| PATCH  | `/api/admin/promotions/:id/active` | `{ isActive }`   |                                  |
| PUT    | `/api/admin/promotions/order`      | `{ ids }`        | must list every id exactly once  |
| DELETE | `/api/admin/promotions/:id`        |                  | 204                              |

## Rules

- Status is derived, never stored: `getPromotionStatus()` from contracts (`inactive` /
  `scheduled` / `expired` / `live`). Public endpoints only ever return `live` promotions.
- Lists are sorted by `sortOrder`; reorder rewrites it in steps of 10 inside one transaction.
- Localization happens here: `LocalizedText` (`{ ka, en, ru }`, all required) is resolved for
  the requested locale. The site never receives other languages.
- Every admin mutation (`AdminPromotionsService`): audit entry `promotion.<action>` with
  before/after, then revalidates the site's `promotions` cache tag.

## Storage

Table `promotions` (`promotions.schema.ts`): localized fields are `jsonb`, `placements` is
`text[]`, `category` is the `promotion_category` enum, schedule columns are `timestamptz`.
`PromotionsRepository` (abstract class = DI token) → `DrizzlePromotionsRepository`. Unique slug
violations become `PromotionSlugTakenError` → HTTP 409.

Known gap: the audit insert is not in the same transaction as the change. Fine for now; revisit
when we add a transaction helper (wallet will need one anyway).

## Seed

`pnpm --filter @metrobet/api db:seed` inserts `promotions.seed.ts` (idempotent by slug). The seed
images are site-relative paths served by `apps/web/public`.
