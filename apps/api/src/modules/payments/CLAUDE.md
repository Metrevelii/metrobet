# Payments (api)

Money in and out of the platform: **deposits** through a bank's hosted card page and
**withdrawals** approved by finance. Banks sit behind the `PaymentGateway` port; today it is
bound to the **mock bank** (`gateway/mock/`, TBC / BoG stand-in). Money moves only through
`Ledger.post`, in the same DB transaction as the payment's status change.

## Deposit

```
player ─POST /payments/deposits─▶ deposit limits (responsible gaming) ─▶ payment `pending`
       ◀── redirectUrl (bank card page) ──┘
bank page ─card─▶ bank ─signed POST /payments/callback─▶ handleCallback ─▶ ledger + `succeeded`
          └─303─▶ WEB_URL/wallet?payment=<id> (the page shows the outcome)
```

- Only the **signed callback** credits money (`x-payment-signature`, HMAC-SHA256 of the raw body
  with `PAYMENT_GATEWAY_SECRET`). Returning to `/wallet?payment=` changes nothing.
- Idempotent: ledger key `payment:<id>`; a repeated callback with the same outcome is a no-op, a
  contradicting one for a final payment is 409; the amount must match (400).
- A successful callback saves the card (`saved_cards`: bank token, mask, brand, expiry; never the
  number). Deposits not completed in 30 min become `expired` (lazily, on reads); a late success
  is still credited because the card was charged. Deposit limits are checked when the deposit
  starts, not in the callback (the bank has already taken the money).

## Withdrawal

- Needs a confirmed contact (`UNVERIFIED` 403) and a saved card of the player (paid back to a
  card used for deposits). KYC will gate it too once a KYC provider exists.
- Request: player → `withdrawals` account at once (`withdrawal`, key `payment:<id>:hold`), so the
  balance is right and can't be spent twice. `INSUFFICIENT_FUNDS` 402.
- Player cancel (while `pending`), staff **reject** (reason shown to the player) and a bank
  refusal on payout all give it back: `withdrawals` → player (`withdrawal_reversal`,
  `payment:<id>:reversal`).
- Staff **approve** (finance): `PaymentGateway.payout`; paid → `withdrawals` → `funding`
  (`payout`, `payment:<id>:payout`, not on the player's side of the ledger); refused → reversal,
  status `failed`; no answer → 502, nothing changes. Row locked `FOR UPDATE` throughout.
- Audit: `payment.withdrawal_approve | payment.withdrawal_reject`.

## Endpoints

| Method | Path                               | Auth                   | Notes                                               |
| ------ | ---------------------------------- | ---------------------- | --------------------------------------------------- |
| POST   | `/payments/deposits`               | player                 | `{ provider, amount }` → `{ payment, redirectUrl }` |
| POST   | `/payments/withdrawals`            | player                 | `{ cardId, amount }`                                |
| POST   | `/payments/withdrawals/:id/cancel` | player                 | 409 `NOT_CANCELLABLE` when not pending              |
| GET    | `/payments`, `/payments/:id`       | player                 | `?kind&page`                                        |
| GET    | `/payments/cards`                  | player                 | saved cards                                         |
| POST   | `/payments/callback`               | bank signature         | `paymentCallbackSchema`                             |
| GET    | `/admin/payments`                  | finance, support, risk | `?kind&status&playerId&page`; queue oldest first    |
| POST   | `/admin/payments/:id/approve`      | finance                |                                                     |
| POST   | `/admin/payments/:id/reject`       | finance                | `{ reason }`                                        |
| POST   | `/dev/wallet/deposit`              | player                 | dev only (404 in production), deposit limits apply  |

Error bodies: `{ code, message, limit? }` (contracts `PAYMENT_ERRORS`).

## Mock bank (`gateway/mock/`)

- `MockPaymentGateway.startDeposit` returns `GET /api/payments/mock/checkout?t=<token>`: the
  token carries payment id, bank, amount and return URL, HMAC-signed and expiring (stateless).
- The page (`mock-checkout-page.ts`, no script, strict CSP) posts back; `MockBankController`
  validates the card (Luhn, expiry, CVC), decides, then `MockBankCallbacks` POSTs the signed
  callback to our own API **over HTTP** (`API_PUBLIC_URL`), like a bank, and redirects to the
  site. Test cards are listed on the page: `…0002` is declined, payouts to `…0119` fail.
- E2e tests swap `MockBankCallbacks.send` to route the callback into the test app.

## Replacing with a real bank

Implement `PaymentGateway` (create order → redirect URL; payout API), add a callback adapter
for the bank's own format/signature that calls `PaymentsService.handleCallback`, and bind it in
`payments.module.ts`. Restrict the callback route to the bank's IPs.
