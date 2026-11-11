# Wallet (web)

The player's balance in the header and the `/wallet` page (balance + transaction history).
Money rules and the ledger live in the API: `apps/api/src/modules/wallet/CLAUDE.md`.

## Data flow

```
api /wallet, /wallet/transactions ──▶ data.ts (request-time, never cached) ──▶ HeaderBalance / WalletView
```

- `getWallet()` is React-`cache`d per request, so the header chip and the page share one call.
  Both loaders return `null` when signed out or when the API fails: the header then shows no
  chip and the page shows "unavailable". Never crash the shell.
- Amounts arrive in minor units; format with `toMajor` + `format.number(…, { style: 'currency' })`
  only at render time. Dates are shown in `Asia/Tbilisi`.
- History pages are links (`/wallet?page=N`), so they work without client JS.
- `/wallet` redirects signed-out visitors to `/login?next=/wallet`.

## Live balance while playing

`LiveBalance` (client, in the header chip) shows the latest pushed balance (player live
channel, `features/notifications`, or a running game) via `setLiveBalance` (from `live-balance.tsx`; import the file directly), else the server value. The
chip is keyed by the server balance, so a new server value (e.g. after a deposit) drops the live
one.

## Dev deposits

`DevDeposit` (client, only rendered when `NODE_ENV !== 'production'`) calls the `devDeposit`
Server Action → `POST /api/dev/wallet/deposit` (404 in production), then `router.refresh()` so the
header and page re-render with the new balance.

## Deposit / withdraw

The balance card links to `/wallet/deposit` and `/wallet/withdraw` (`features/payments`); the
`/wallet` page composes `PaymentResult` and `PendingWithdrawals` (passed as `WalletView`
children).

## Not yet

Filters by type/date, bonus balance.
