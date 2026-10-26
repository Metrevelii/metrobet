# @metrobet/backoffice: staff tool

Next.js 16 App Router + `@metrobet/ui`. Runs on port 3001. English only (no i18n). `noindex`.

## Structure

```
src/
  app/                 routes (dashboard at /)
  components/          backoffice-only components (Sidebar)
  config/navigation.ts BACKOFFICE_NAV: single source for the sidebar
  features/<area>/     players, bets, sportsbook, games, audit-log (to be built)
```

## Planned scope

Players (search, profile, limits, self-exclusion, KYC status) · Bets (search, ticket detail,
manual settle/void) · Sportsbook (events, markets, margins, suspend/resume) · Games & providers
(enable/disable, categories, ordering) · Bonuses · Reports · **Audit log**.

## Rules

- **RBAC on every route and action** (roles: admin, risk, support, finance), enforced by the API.
  The UI only hides what the user cannot do.
- **Every mutating action is audit-logged by the API** (who, what, before/after, when).
- Data-dense screens: tables with server-side pagination, filters in the URL (shareable links).
- Reuse `@metrobet/ui`. If a primitive is missing (Table, Dialog, Select…), add it to the UI
  package, not here, so the player site can use it too.
- Same Next 16 rules as `apps/web` (Cache Components, `proxy.ts`), see `apps/web/CLAUDE.md`.
