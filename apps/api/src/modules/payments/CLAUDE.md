# Payments (api)

Money in and out of the platform. Today only the **dev deposit** (`POST /dev/wallet/deposit`,
404 in production, ≤ 1 000 ₾). TBC / BoG deposits and withdrawals go here.

Rules for every deposit path: check `ResponsibleGamingService.assertCanDeposit` first (403
`LIMIT_EXCEEDED`, contracts `limitErrorSchema`), then let `WalletService` post the money with
an idempotency key. It lives outside `wallet` so the wallet module doesn't depend on
responsible gaming (which reads usage from the wallet).
