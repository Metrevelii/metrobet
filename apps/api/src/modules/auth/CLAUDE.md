# Auth (api)

Shared identity infrastructure, global module. Player accounts live in `modules/players`, staff
accounts in `modules/staff`; both use this module.

## Sessions

- Opaque 256-bit bearer tokens (`Authorization: Bearer <token>`); only their SHA-256 is stored
  (`sessions` table), so they're revocable and a DB leak can't sign anyone in. Not JWTs.
- Lifetime: players 30 days, staff 12 hours (absolute). `lastUsedAt` is touched at most every 5 min.
- The API never sets cookies. The web apps keep the token in an httpOnly cookie on their own
  origin and forward it server-side (BFF pattern).
- `revokeAll(subject, id)` signs out everywhere (used after password resets).

## Guards

- `@UseGuards(PlayerAuthGuard)` + `@CurrentPlayer()` for player routes.
- `@UseGuards(StaffAuthGuard)` + `@Roles('marketing', …)` + `@CurrentStaff()` for `/admin/*`.
  `admin` always passes. Disabled staff are rejected even with a live session. Use
  `staffActor(staff)` (`staff:<uuid>`) as the audit actor.
- Player tokens are never accepted as staff tokens (sessions are typed by subject).

## Passwords & codes

- Argon2id (`@node-rs/argon2`, OWASP params). `PasswordHasher.verify` hashes against a dummy
  when the account doesn't exist, so response time doesn't reveal accounts.
- 6-digit codes (`VerificationService`): hashed, 10-min expiry, 60-s resend cooldown (429),
  5 wrong guesses burn the code, issuing a new code invalidates older ones.
- Auth routes use `ThrottlerGuard` (`AUTH_RATE_LIMIT` per minute per client IP; in-memory, use
  Redis storage to scale). `TRUST_PROXY` must include the web servers so `X-Forwarded-For`
  (the player's IP, forwarded by the web app) is honoured.

## Gotcha

Scripts that boot Nest (`db:seed`, `staff:create`) run compiled JS (`node dist/...`), not `tsx`.
`@nestjs/core` 12 is ESM-only and tsx's CommonJS loader creates a second copy of it for CJS
packages like `@nestjs/throttler`, breaking DI ("can't resolve Reflector").
