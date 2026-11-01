# @metrobet/backoffice: staff tool

Next.js 16 App Router + `@metrobet/ui`. Runs on port 3001. English only (no i18n). `noindex`.

## Structure

```
src/
  app/(app)/           signed-in area (layout: sidebar + RequireStaff): dashboard, promotions…
  app/login/           staff sign-in
  proxy.ts             no session cookie → /login (fast path; the API validates everything)
  components/          backoffice-only components (Sidebar, PageHeader)
  features/auth/       login form/actions, getCurrentStaff, RequireStaff
  config/navigation.ts BACKOFFICE_NAV: single source for the sidebar
  features/<area>/     promotions (see its CLAUDE.md), players, bets, audit, dashboard
  lib/format.ts        money(minor) / dateTime(iso) in Asia/Tbilisi, en-GB
  lib/query.ts         withQuery(path, params), param(), pageParam(): filters live in the URL
  lib/actions.ts       runAction(paths, mutation): Server Action wrapper → ActionResult
  components/pager.tsx Previous / next links that keep the filters; no-access.tsx for roles
  hooks/use-now.ts     current time after mount (keeps time-dependent UI out of static HTML)
  lib/admin-api.ts     adminFetch(): server-only calls to /api/admin/* with the staff session
  lib/session.ts       mb_staff httpOnly cookie (SameSite=strict) + forwarded client headers
  lib/media.ts         resolveMediaUrl(): previews site-relative artwork from the web origin
```

## Data & mutations

- **Reads:** feature `data.ts` (server) → `adminFetch` (`no-store`). Pages render them inside
  `<Suspense>` with a skeleton (request-time data under Cache Components).
- **Writes:** Server Actions in feature `actions.ts` (`'use server'`). They re-validate input
  with the contracts schema, call the API, `revalidatePath()` the list, and return
  `ActionResult` (`{ ok, data } | { ok: false, error, fieldErrors }`). Never throw to the client.
- Staff sign in at `/login`; the session token lives in the httpOnly `mb_staff` cookie and is
  sent as a bearer token by `adminFetch`. Client components never call the API directly.
- Roles are enforced by the API (403); hide UI the role can't use when building new screens.
- Optimistic UI for list operations (toggle/reorder/delete), with rollback on failure.
- Anything time-dependent (statuses like live/expired) uses `useNow()`; dates shown to staff are
  formatted in `Asia/Tbilisi`.

## Feedback

`<Toaster />` in the root layout (top right). Mutations report the outcome with
`toast.success(…)` / `toast.error(result.error)`; field errors (e.g. a missing reason) stay
next to the field. Optimistic list operations roll back and show the error as a toast.

## Env (`.env.local`, see `.env.example`)

`API_URL`, `NEXT_PUBLIC_WEB_URL` (player site origin for previews).

## Screens

| Route               | Roles (admin always)   | What                                                                                                              |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                 | every role             | Today (Tbilisi): GGR, stakes/wins/refunds per product, players, open tickets, balances owed                       |
| `/players`          | support, risk, finance | Search (email, phone, id) + status filter; balance per player                                                     |
| `/players/[id]`     | support, risk, finance | Account facts; status change with reason (support, risk); tabs: transactions, sports tickets, game rounds         |
| `/bets`             | support, risk, finance | Sports tickets, filters status / sport                                                                            |
| `/bets/[id]`        | support, risk, finance | Selections with results; **risk**: settle a selection by hand, void ticket                                        |
| `/sportsbook`       | risk                   | Live/upcoming events (sport, state, search): open tickets, stakes, worst case; suspend/resume event; 10 s refresh |
| `/sportsbook/[id]`  | risk                   | Effective margin/limits, liability per selection (net if it wins), player vs feed odds, suspend/resume markets    |
| `/sportsbook/rules` | risk                   | Margin and stake/payout limits per sport or competition (edit, delete); defaults shown                            |
| `/audit-log`        | risk                   | Every staff change (who, what, before/after), filter by entity                                                    |

Pages check the role with `hasRole(getCurrentStaff(), roles)` and show `NoAccess`; the API
enforces the same roles. Actions ask for a reason (stored in the audit log).

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
