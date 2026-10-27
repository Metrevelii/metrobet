# Auth (web)

Pages: `/login`, `/register`, `/verify`, `/forgot-password`. Header shows `HeaderAccount`
(account menu or log in / sign up).

## How it works

- **Server Actions** (`actions.ts`) call the API and store the session token in the httpOnly
  `mb_session` cookie (`lib/session.ts`). Browser JS never sees tokens. Server Components read
  the player with `getCurrentPlayer()` (React `cache`, request-time: render inside `<Suspense>`).
- Actions validate with the same contracts schemas first (instant field errors), then map API
  failures to keys: `error` → `Auth.errors.*`, field errors → `Auth.validation.*`. Translate
  with `useAuthForm()`.
- `clientHeaders()` forwards the player's IP and user agent so API rate limits apply per player.
- `?next=` is sanitized by `safeNext` (relative paths only, locale prefix stripped).
- After success, forms call `router.push(next)` + `router.refresh()` so the header updates.

## Client components that need "signed in?"

Use `useSignedIn()` from `@/features/auth/session-store` (import the file directly, not the
barrel: the barrel also exports server-only code). `<SessionSync>` in the header publishes the
server's answer.

## Not yet

Real-money actions (deposits, placing bets) wait for wallet + KYC. Profile/settings, 2FA and
"sign out everywhere" UI come later.
