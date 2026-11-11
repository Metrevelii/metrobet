# Payments (web)

`/wallet/deposit`, `/wallet/withdraw`, and on `/wallet`: the deposit outcome banner
(`?payment=<id>`, `PaymentResult`) and pending withdrawals (`PendingWithdrawals`, cancellable).
API rules: `apps/api/src/modules/payments/CLAUDE.md`.

- **Deposit** (`DepositForm`): bank (TBC / BoG) + amount → `startDeposit` action → the browser
  goes to the bank's card page (`window.location.assign`). Card data never touches Metrobet. The
  bank sends the player back to `/wallet?payment=<id>`; the server reads the payment, so the
  banner shows the real outcome (the callback has already been processed).
- **Withdraw** (`WithdrawForm`): one of the saved cards + amount. Needs a confirmed contact, a
  verified identity (link to `/account/identity`) and a saved card (otherwise "deposit first").
  A deposit past the KYC threshold fails with `KYC_REQUIRED` and links there too. With an
  active bonus the form warns that withdrawing forfeits it and needs a checkbox
  (`forfeitBonus`).
- Errors: `Payments.errors.<code>`, field errors `Payments.validation.<key>` (keys come from the
  contracts schemas); a deposit limit uses `useLimitMessage` with a link to the limits page.
