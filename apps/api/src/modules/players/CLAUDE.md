# Players (api)

Player accounts and authentication (`/api/auth/*`).

| Method | Path                         | Auth   | Notes                                                                                          |
| ------ | ---------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| POST   | `/auth/register`             | –      | `{ identifier, password, dateOfBirth, acceptTerms, locale }` → session + profile; sends a code |
| POST   | `/auth/login`                | –      | `{ identifier, password }` → session + profile; 401 generic, 403 suspended/self-excluded       |
| POST   | `/auth/logout`               | player | revokes the current session                                                                    |
| GET    | `/auth/me`                   | player | `PlayerProfile`                                                                                |
| POST   | `/auth/verification/send`    | player | new code to the login contact (429 within 60 s)                                                |
| POST   | `/auth/verification/confirm` | player | `{ code }` → profile with `verified: true`                                                     |
| POST   | `/auth/password/forgot`      | –      | always 204 (no account enumeration)                                                            |
| POST   | `/auth/password/reset`       | –      | `{ identifier, code, password }`; signs out all sessions                                       |

## Rules

- **Identifier** = email OR mobile (`parseIdentifier` in contracts): emails lower-cased, phones
  normalized to E.164 with Georgia as default country (`555 12 34 56` → `+995555123456`). Both
  columns are unique; at least one is set (DB check).
- **Age**: `dateOfBirth` must be ≥ 25 years (Georgian law), checked by the shared schema.
- **Verification** confirms the login contact only. **KYC** (`kycStatus`) is separate and will
  be driven by a KYC provider (Sumsub/Veriff…) before real-money play.
- Validation messages for player schemas are translation keys (see contracts `auth.ts`).
- Codes are delivered through the `Notifier` port (`modules/notifications`). Dev: API log +
  `GET /api/dev/outbox?to=…` (404 in production).
