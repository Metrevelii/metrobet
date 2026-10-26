# @metrobet/contracts: shared schemas

The single source of truth for everything the frontends and the API must agree on: Zod schemas,
inferred types, enums and constants (`LOCALES`, `CURRENCIES`, socket event names, DTOs).

- Define the **schema** first, then derive the type with `z.infer`. Never hand-write a type that
  duplicates a schema.
- The API validates incoming data with these schemas; the frontends type responses with them.
- Group by domain: `src/common/`, later `src/sportsbook/`, `src/casino/`, `src/wallet/`. Re-export
  everything from `src/index.ts`.
- ESM with NodeNext resolution: relative imports need the `.js` extension.
- **Built to `dist/`** with `tsc` (consumers import compiled JS so Nest's ESM runtime and Next
  both work). Turbo builds it before any dependent task. During development, run
  `pnpm --filter @metrobet/contracts dev` for watch mode if editing it alongside an app.
- No runtime dependencies besides `zod`. No framework code (no React, no Nest).
