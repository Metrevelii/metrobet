# Promotions module (api)

Serves promo banners/pages to the web app; will be managed from the backoffice.

## Endpoints (public)

| Method | Path                                       | Returns                  |
| ------ | ------------------------------------------ | ------------------------ |
| GET    | `/api/promotions?locale=ka&placement=home` | `PromotionCard[]`        |
| GET    | `/api/promotions/:slug?locale=ka`          | `PromotionDetail` or 404 |

Queries are validated with contracts schemas via `ZodValidationPipe` (400 on bad input).

## Rules

- A promotion is **live** when `isActive` and `startsAt <= now < endsAt` (nulls = open-ended).
  Only live promotions are ever returned, both in lists and by slug (`promotions.mapper.ts`).
- Lists are sorted by `sortOrder` ascending (backoffice drag-and-drop order).
- Localization happens here: stored `LocalizedText` (`{ ka, en, ru }`, all required) is resolved
  to plain strings for the requested locale. The web app never receives other languages.

## Storage

`PromotionsRepository` is an abstract class used as the DI token. Today it's bound to
`InMemoryPromotionsRepository` (seeded from `promotions.seed.ts`, validated with
`promotionSchema` on startup, so a bad seed fails fast).

When Postgres lands: add `promotions.schema.ts` (Drizzle table, localized fields as `jsonb`),
`DrizzlePromotionsRepository`, and switch the binding in `promotions.module.ts`. Service,
controller and web stay unchanged.

## Backoffice (next)

Admin endpoints (`/api/admin/promotions`: list all incl. inactive/expired, create, update,
reorder, toggle, delete) using the full `promotionSchema`, behind auth + RBAC + audit log, plus
image upload. After each change, ask the web app to revalidate the `promotions` cache tag.
