# @metrobet/api: NestJS backend

NestJS 12, **ESM** (`"type": "module"`, NodeNext), PostgreSQL via Drizzle. Port 4000, all routes
under `/api` (e.g. `GET /api/health`).

## Structure

```
src/
  main.ts              bootstrap only
  app.setup.ts         configureApp(): global prefix, CORS, shutdown hooks (shared with e2e)
  app.module.ts        root module: Config, Database, feature modules
  config/env.ts        Zod env schema, validated on boot (fails fast)
  database/
    database.module.ts global pg Pool + Drizzle providers
    database.tokens.ts DRIZZLE / PG_POOL tokens, `Database` type
    schema/index.ts    re-exports every module's tables (used by drizzle-kit)
  modules/<name>/      one folder per bounded context (health now; later auth, wallet,
                       sportsbook, casino, bonus, risk, backoffice)
test/                  e2e specs (*.e2e-spec.ts)
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

## Gotchas

- **ESM**: relative imports need the `.js` extension (`'./health.controller.js'`).
- **Do not use `import type` for injected classes.** DI relies on `emitDecoratorMetadata`;
  type-only imports erase the class. That is why `verbatimModuleSyntax` is off here and the
  `consistent-type-imports` lint rule is disabled for `apps/api`.
- Env validation runs when `AppModule` is imported. Tests set env in `vitest.config*.ts`
  (`test.env`), not inside test files.
- Tests: unit `*.spec.ts` next to the code (`pnpm test`), e2e in `test/` (`pnpm test:e2e`). Mock
  infrastructure with `overrideProvider(DRIZZLE)`.
