# Account (web)

`/account` (profile), `/account/identity` (KYC: status, "Verify my identity" → provider page →
back here, rejection reasons), `/account/security` (change password, signed-in devices),
`/account/responsible-gaming` (limits, reality check, take a break / self-exclusion). Linked from
the account menu. API rules: `apps/api/src/modules/responsible-gaming/CLAUDE.md`.

- `AccountLayout` = title + `AccountTabs` (plain links, each page passes its tab, so no URL
  hooks) + the content inside `<Suspense>`, redirecting signed-out visitors to log in.
- Server Actions (`actions.ts`) reuse the auth form conventions: errors are `Auth.errors.*` keys
  (`wrongPassword` for a 403), field errors `Auth.validation.*`; forms use `useAuthForm()`.
- **Limits** (`LimitsSection`): one card per kind, a row per period with usage bar, pending
  change ("changes to X on …") and inline edit. The API decides now vs. in 24 h; the toast says
  which.
- **Exclusion** (`ExclusionCard`): period chips, password, confirmation dialog. On success the
  action clears the session cookie and the page goes home.
- **Reality check**: `<RealityCheck />` in the header (signed-in only) mounts
  `RealityCheckReminder` when an interval is set. The visit start and next reminder live in
  `sessionStorage` (per tab); the dialog shows minutes played and `playActivity(since)`.
- `useLimitMessage()` + `LIMITS_HREF` (`use-limit-message.ts`): the "X left of your daily loss
  limit" text for `LIMIT_EXCEEDED`, used by the betslip and dev deposits (Originals show
  `Originals.errors.LIMIT_EXCEEDED`).
