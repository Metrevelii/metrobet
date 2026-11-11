# Players (api)

Player accounts and authentication (`/api/auth/*`).

| Method | Path                           | Auth   | Notes                                                                                          |
| ------ | ------------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| POST   | `/auth/register`               | –      | `{ identifier, password, dateOfBirth, acceptTerms, locale }` → session + profile; sends a code |
| POST   | `/auth/login`                  | –      | `{ identifier, password }` → session + profile; 401 generic, 403 suspended/self-excluded       |
| POST   | `/auth/logout`                 | player | revokes the current session                                                                    |
| GET    | `/auth/me`                     | player | `PlayerProfile`                                                                                |
| POST   | `/auth/verification/send`      | player | new code to the login contact (429 within 60 s)                                                |
| POST   | `/auth/verification/confirm`   | player | `{ code }` → profile with `verified: true`                                                     |
| POST   | `/auth/password/forgot`        | –      | always 204 (no account enumeration)                                                            |
| POST   | `/auth/password/reset`         | –      | `{ identifier, code, password }`; signs out all sessions                                       |
| POST   | `/auth/password/change`        | player | `{ currentPassword, password }`; 403 wrong password; signs out the other sessions              |
| GET    | `/auth/sessions`               | player | live sessions (ip, user agent, last used, `current`)                                           |
| POST   | `/auth/sessions/:id/revoke`    | player | 204; 404 when not the player's live session                                                    |
| POST   | `/auth/sessions/revoke-others` | player | 204; every session but the current one                                                         |

## Admin (`/api/admin/players`, `AdminPlayersService`)

| Method | Path                        | Roles                  | Notes                                                                    |
| ------ | --------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| GET    | `/admin/players`            | support, risk, finance | `?search` (email, phone digits, id) `&status&page`; with balances        |
| GET    | `/admin/players/:id`        | support, risk, finance | `AdminPlayer`                                                            |
| PATCH  | `/admin/players/:id/status` | support, risk          | `{ status, reason }`; not `active` → every session revoked; audit-logged |

A player's history lives in the owning modules: `/admin/players/:id/transactions` (wallet),
`/admin/players/:id/rounds` (game-wallet), `/admin/bets?playerId=` (betting).

## Rules

- **Self-exclusion** (`status: self_excluded`, `excludedUntil`) is set by
  `modules/responsible-gaming`; login refuses it until `excludedUntil`, then reactivates.

- **Identifier** = email OR mobile (`parseIdentifier` in contracts): emails lower-cased, phones
  normalized to E.164 with Georgia as default country (`555 12 34 56` → `+995555123456`). Both
  columns are unique; at least one is set (DB check).
- **Age**: `dateOfBirth` must be ≥ 25 years (Georgian law), checked by the shared schema.
- **Verification** confirms the login contact only. **KYC** (`kycStatus`, `firstName`,
  `lastName`, unique `personalNumber`, `kycVerifiedAt`) is set by `modules/kyc` through
  `setKyc`; the profile carries the verified name.
- Validation messages for player schemas are translation keys (see contracts `auth.ts`).
- Codes are delivered through the `Notifier` port (`modules/notifications`). Dev: API log +
  `GET /api/dev/outbox?to=…` (404 in production).
