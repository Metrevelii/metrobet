# KYC (api)

Identity verification. A provider (Sumsub / Veriff later, `MockKycProvider` today, behind the
`KycProvider` port) reads the player's document; we check the result against the account and
keep one account per person. `players.kycStatus` is the summary every other module reads;
`kyc_checks` holds each attempt.

## Flow

```
player ─POST /kyc/checks─▶ check `started` (older unfinished ones → `abandoned`)
       ◀── redirectUrl (provider page) ──┘
provider page ─▶ provider ─signed POST /kyc/callback─▶ handleCallback ─▶ check + players.kycStatus
              └─303─▶ WEB_URL/account/identity?check=<id>
```

- Only the **signed callback** changes anything (`x-kyc-signature`, HMAC-SHA256 of the raw body
  with `KYC_PROVIDER_SECRET`). Idempotent: the same outcome again is a no-op; a different
  outcome for a decided check is 409.
- Outcomes: `approved` → **our own checks** (`approveIfValid`): the document's date of birth
  must equal the registered one (`dob_mismatch`), 25+ again (`underage`), and the personal
  number must not be on another account (`duplicate`; also a unique index on
  `players.personal_number`). Passing stores name + personal number on the player and sets
  `verified`. `rejected` → `document`. `review` → staff queue, player `pending`.
- Staff (support, risk) decide checks in `review`: approve runs the same checks (so staff can't
  approve a duplicate), reject needs a reason and a note. Audit: `kyc.approve | kyc.reject`.
- A player can start a new check unless verified or a check is in review (409).

## Where it is required

`modules/payments`: every withdrawal, and deposits once lifetime deposits would pass
`KYC_DEPOSIT_THRESHOLD` (1 000 ₾, contracts) → `KYC_REQUIRED` 403.

## Endpoints

| Method | Path                      | Auth                   | Notes                                                              |
| ------ | ------------------------- | ---------------------- | ------------------------------------------------------------------ |
| GET    | `/kyc`                    | player                 | `KycOverview` (status, name, latest check)                         |
| POST   | `/kyc/checks`             | player                 | → `{ checkId, redirectUrl }`; 409 verified / in review             |
| POST   | `/kyc/callback`           | provider signature     | `kycCallbackSchema`                                                |
| GET    | `/admin/kyc`              | support, risk, finance | `?status&playerId&page`; review queue oldest first                 |
| POST   | `/admin/kyc/:id/decision` | support, risk          | `{ decision: approve }` or `{ decision: reject, rejection, note }` |

## Mock provider (`provider/mock/`)

A hosted form served by the API (`GET|POST /api/kyc/mock/verify?t=`, signed expiring token via
`common/signed-token`, no script, strict CSP). The player types what the document says;
outcome by personal number: ending `0000` rejected, `9999` review, else approved. The webhook
goes over real HTTP (`MockKycCallbacks`, swapped in e2e tests).

## Replacing with a real provider

Implement `KycProvider.startCheck` (create applicant + access link), add a webhook adapter for
the provider's format/signature that calls `KycService.handleCallback`, bind it in
`kyc.module.ts`. Store document images at the provider, never here.
