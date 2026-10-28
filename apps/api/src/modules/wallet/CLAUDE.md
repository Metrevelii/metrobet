# Wallet module (api)

Player money: a **double-entry ledger** in GEL minor units (tetri). Every balance change is one
`wallet_transactions` row plus two or more `wallet_entries` rows that move money between
`wallet_accounts`. Game bets/wins (aggregator wallet callbacks), payments and staff adjustments
all go through `Ledger.post`; nothing else writes these tables.

## Invariants (do not break these)

1. **Integers only.** Amounts and balances are `bigint` minor units (read as JS `number`, safe up
   to 2^53). Never floats, never major units in the API.
2. **Every transaction sums to zero.** Money is moved, never created: entries of one transaction
   add up to 0. Enforced in `Ledger.post` and by a deferred constraint trigger in Postgres
   (`wallet_entries_balanced`), so a bug or a hand-written SQL insert cannot break it.
3. **Append-only.** Transactions and entries are never updated or deleted (DB triggers reject it).
   A mistake is fixed with a new compensating transaction (`rollback`, `adjustment`).
4. **`balance` is a cache of the entries.** `wallet_accounts.balance` = sum of its entries'
   `amount`, updated in the same DB transaction as the entries. Each entry stores
   `balanceAfter`, so history needs no recomputation. Recompute check: `Ledger` spec / e2e.
5. **Player balances never go negative.** Checked under the row lock and by a DB `check`.
   System accounts (`house`, `funding`) may go negative: they are the other side of the books.
6. **Idempotent by key.** Each transaction has a unique `idempotencyKey` (aggregator transaction
   id, payment id, `dev:<uuid>`…). Posting the same key again returns the first result and moves
   nothing; reusing a key for a different player/type/amount is a 409.
7. **Locks in id order.** `post` locks the accounts it touches with `SELECT … FOR UPDATE`, sorted
   by id, so concurrent transactions queue instead of deadlocking or overspending.

`Ledger.post(input, tx?)`: pass your own DB transaction to commit the money movement together
with your rows (it runs in a savepoint). The game wallet module does this for every round call.

## Accounts

| kind      | owner  | meaning                                                                 |
| --------- | ------ | ----------------------------------------------------------------------- |
| `player`  | player | the player's cash balance (one per player and currency, created lazily) |
| `house`   | –      | casino side: bets go in, wins come out                                  |
| `funding` | –      | outside money: deposits come from it, withdrawals go to it              |

Transaction types (contracts `WALLET_TRANSACTION_TYPES`):

| type         | entries                       | source                          |
| ------------ | ----------------------------- | ------------------------------- |
| `deposit`    | funding −, player +           | payments (dev deposit for now)  |
| `withdrawal` | player −, funding +           | payments (later)                |
| `bet`        | player −, house +             | game wallet API (`game-wallet`) |
| `win`        | house −, player +             | game wallet API (`game-wallet`) |
| `rollback`   | reverses a bet                | game wallet API (`game-wallet`) |
| `adjustment` | either way, staff + audit log | backoffice (later)              |

## Endpoints

| Method | Path                   | Auth   | Notes                                                                                       |
| ------ | ---------------------- | ------ | ------------------------------------------------------------------------------------------- |
| GET    | `/wallet`              | player | `Wallet` (balance 0 before the first transaction)                                           |
| GET    | `/wallet/transactions` | player | `WalletTransactionsPage`, newest first, `?page&pageSize`                                    |
| POST   | `/dev/wallet/deposit`  | player | **Dev only** (404 in production). `{ amount }` ≤ 1 000 ₾; optional `Idempotency-Key` header |

## Not yet

Real payments (TBC/BoG), withdrawals, limits/self-exclusion checks, bonus money (a separate
`bonus` account kind with wagering), staff adjustments with audit, reconciliation job.
