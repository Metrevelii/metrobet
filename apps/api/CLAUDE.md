# @metrobet/api: NestJS backend

NestJS 12, **ESM** (`"type": "module"`, NodeNext), PostgreSQL via Drizzle. Port 4000, all routes
under `/api` (e.g. `GET /api/health`).

## Structure

```
src/
  main.ts              bootstrap only
  app.setup.ts         configureApp(): prefix, CORS, shutdown hooks, /media static (shared with e2e)
  app.module.ts        root module: Config, Database, feature modules
  config/env.ts        Zod env schema, validated on boot (fails fast)
  database/
    database.module.ts global pg Pool + Drizzle providers
    database.tokens.ts DRIZZLE / PG_POOL tokens, `Database` type
    schema/index.ts    re-exports every module's tables (used by drizzle-kit)
    errors.ts          isUniqueViolation() for Postgres constraint errors
    migrate.ts seed.ts scripts (db:migrate, db:seed via tsx)
  common/              guards (AdminKeyGuard), pipes (ZodValidationPipe)
  modules/<name>/      one folder per bounded context:
                         health · promotions · audit (audit_log) · media (uploads)
                         · web (revalidates the player site's cache)
                       later: auth, wallet, sportsbook, casino, bonus, risk
test/                  e2e specs (*.e2e-spec.ts) against a real `metrobet_test` database
drizzle/               generated SQL migrations (commit them)
```

## Modular monolith rules

- Each module owns its tables (`<name>.schema.ts`), services and controllers. Other modules use
  its **exported service**, never its tables directly.
- Controllers stay thin: validate input (Zod schema from `@metrobet/contracts`), call a service,
  return a contract type.
- Response and request types come from `@metrobet/contracts`. Do not declare DTO shapes locally.
- Give each non-trivial module its own `CLAUDE.md` (invariants, flows). **Wallet** must document
  its ledger invariants before any code.

## Database

- Inject with `@Inject(DRIZZLE) private readonly db: Database`.
- New table: define it in the module's `*.schema.ts`, re-export from `database/schema/index.ts`,
  then `pnpm --filter @metrobet/api db:generate` and `db:migrate`. Never edit generated migrations
  by hand after they are committed.
- Local Postgres: `docker compose up -d` from the repo root. Copy `.env.example` to `.env`.
- Casing: TypeScript camelCase ↔ SQL snake_case is automatic (`casing: 'snake_case'` in both
  the client and drizzle.config). Don't write column names by hand.
- Timestamps are `timestamptz` read as `Date`; convert to ISO strings at the repository edge
  (contracts use ISO strings). Localized copy is `jsonb` typed as `LocalizedText`.
- Map unique-constraint violations to domain errors in the repository (`isUniqueViolation`), and
  to HTTP 409 in the service.

## Admin endpoints

- Everything under `/api/admin/*` uses `@UseGuards(AdminKeyGuard)` (temporary shared key, header
  `x-admin-key`). Attribute changes to `ADMIN_KEY_ACTOR` until staff accounts exist.
- Every admin mutation must `AuditService.record()` (before/after) and, if it changes what the
  player site shows, call `WebRevalidationService.revalidate(tag)`.
- Media: `POST /api/admin/media/:folder` (multipart `file`). Type is checked by magic bytes
  (PNG/JPEG/WebP/AVIF; SVG is rejected). Stored by `MediaStorage` (local disk now, served at
  `/media`); swap the binding for S3/CDN later.

## Gotchas

- **ESM**: relative imports need the `.js` extension (`'./health.controller.js'`).
- **Always inject with an explicit token: `@Inject(SomeService)` / `@Inject(DRIZZLE)`.** Vitest
  transpiles without decorator metadata, so type-based injection silently gets `undefined` in tests.
  Ports are abstract classes (e.g. `PromotionsRepository`) used directly as tokens.
- Validate input with `new ZodValidationPipe(schemaFromContracts)` (`src/common/pipes`) on
  `@Query`, `@Body` and `@Param`.
- **Do not use `import type` for injected classes.** DI relies on `emitDecoratorMetadata`;
  type-only imports erase the class. That is why `verbatimModuleSyntax` is off here and the
  `consistent-type-imports` lint rule is disabled for `apps/api`.
- Env validation runs when `AppModule` is imported. Tests set env in `vitest.config*.ts`
  (`test.env`), not inside test files.
- Tests: unit `*.spec.ts` next to the code (`pnpm test`), e2e in `test/` (`pnpm test:e2e`). Mock
  infrastructure with `overrideProvider(DRIZZLE)`.
