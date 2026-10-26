# @metrobet/web: player site

@AGENTS.md

Next.js 16 App Router, React 19, next-intl, `@metrobet/ui`. Runs on port 3000.

## Structure

```
src/
  app/[locale]/        all routes; layout.tsx is the root layout (html/body)
    page.tsx           home
    sports/ live/ casino/ crash/
  components/
    layout/            AppShell, Header, SideNav, BottomNav, BetslipPanel, LocaleSwitcher, Logo, NavItems
    shared/            app-level reusable blocks (EmptyState, Section, ComingSoon)
  features/<feature>/  product features (promotions, later sportsbook, casino, crash); index.ts is the public API
  lib/api.ts           apiGet(path, schema, params): server-side fetch to @metrobet/api + Zod parse
  config/              single-source config (navigation.ts)
  i18n/                routing.ts, request.ts, navigation.ts
  messages/            ka.json, en.json, ru.json
  proxy.ts             next-intl locale detection/redirects (Next 16 name for middleware)
```

New product areas go in `src/features/<feature>/` with their own `CLAUDE.md`. `app/` route files
stay thin: they fetch/compose and render feature components.

## Layout

`AppShell` is the responsive frame for every page:

- **mobile**: sticky header, content, fixed `BottomNav` (content has bottom padding for it)
- **lg (≥1024px)**: adds the left `SideNav`
- **xl (≥1280px)**: adds the right `BetslipPanel` rail (sticky)

Header tabs, side nav and bottom nav all render from `MAIN_NAV` in `config/navigation.ts`.
Add a section once there (`bottomNav: false` keeps it out of the 5-slot mobile bar). Active state
comes from `<NavItems items renderItem={(item, active) => …} />`, which handles the Suspense rule
below.

## i18n

- Locales come from `@metrobet/contracts` (`LOCALES`, `DEFAULT_LOCALE = 'ka'`).
  `localePrefix: 'as-needed'`: Georgian has no prefix (`/sports`), others do (`/en/sports`).
- The locale is read with **`next/root-params`** in `i18n/request.ts` (not `setRequestLocale`).
  This works with Cache Components and static prerendering.
- Server Components: `await getTranslations('Namespace')`. Client Components:
  `useTranslations('Namespace')` (messages come from `NextIntlClientProvider` in the layout).
- **Always import `Link`, `useRouter`, `usePathname`, `redirect` from `@/i18n/navigation`**,
  never from `next/link` / `next/navigation`, so URLs keep the locale.
- Message keys are typed from `en.json` (`src/global.d.ts`). Add every key to all three files.

## Rendering rules (Next 16 + Cache Components)

- Pages are prerendered per locale (`generateStaticParams` in the layout). Keep them static
  where possible.
- Nothing is cached implicitly. Use `'use cache'` (+ `cacheLife`/`cacheTag`) for cacheable server
  data. Wrap request-time data (cookies, headers, live data) in `<Suspense>` with a skeleton
  fallback.
- Live data (odds, scores, balance) will come over WebSocket in Client Components; server
  renders the initial snapshot.
- Skeletons, not spinners: use `Skeleton` from `@metrobet/ui` matching the final layout.
- **Client hooks that read the URL (`usePathname`, `useSearchParams`, `useParams`) must sit
  inside `<Suspense>`**, or any non-prerendered route (e.g. `/promotions/[slug]`) fails the build
  with `blocking-prerender-client-hook`. Render a URL-agnostic fallback (see `NavItems`,
  `LocaleSwitcher`).
- Route-level `error.tsx` and `not-found.tsx` live in `app/[locale]/`.

## Data from the API

- Server Components only: feature `data.ts` files call `apiGet()` from `@/lib/api` inside
  `'use cache'` with `cacheTag` + `cacheLife`. Client components never call the API for content.
- Builds must not depend on the API being up (CI builds without it): content loaders return an
  empty state or throw to `error.tsx`. Never crash the shell.
- Env (`.env.local`, see `.env.example`): `API_URL`, `MEDIA_PUBLIC_URL` (allowed in
  `images.remotePatterns`), `IMAGES_ALLOW_LOCAL_IP` (dev only), `REVALIDATE_SECRET`.
- **On-demand revalidation:** `POST /api/revalidate { tags }` with header `x-revalidate-secret`
  (called by the api after backoffice changes) runs `revalidateTag(tag, { expire: 0 })`.
- A loader whose failure path uses a short `cacheLife` counts as request-time data: render it
  inside `<Suspense>` (otherwise prerendering fails with `blocking-prerender-dynamic`).

## Styling

Use semantic token classes only (see `packages/ui/CLAUDE.md`). No hex colors, no Tailwind
palette colors, no inline styles for colors. Use `cn()` from `@metrobet/ui` to merge classes.
