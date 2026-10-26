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
    layout/            AppShell, Header, SideNav, BottomNav, BetslipPanel, LocaleSwitcher, Logo
    shared/            app-level reusable blocks (EmptyState, Section, ComingSoon)
  features/<feature>/  product features (sportsbook, casino, crash): components, hooks, mocks
  config/              single-source config (navigation.ts)
  hooks/               cross-feature hooks (use-is-active)
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
Add a section once there. Active state comes from `useIsActive(href)`.

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

## Styling

Use semantic token classes only (see `packages/ui/CLAUDE.md`). No hex colors, no Tailwind
palette colors, no inline styles for colors. Use `cn()` from `@metrobet/ui` to merge classes.
