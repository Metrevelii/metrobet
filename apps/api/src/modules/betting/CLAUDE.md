# Betting module (api)

Sportsbook tickets: placing bets from the betslip, settling them from feed results, and the
player's bet history. Prices and event state come from `SportsbookStore` (sportsbook module);
money moves only through `Ledger.post` (wallet module).

## Flow

```
POST /sportsbook/bets ── validate against SportsbookStore (+ live delay, re-check) ──▶
   one DB transaction: bet_tickets + bet_selections + Ledger.post(bet) ──▶ ActivityBus `sports.bet`
SettlementService (every 15 s) ── OddsFeed.result(eventId) for events with open selections ──▶
   selection results ──▶ settle each affected ticket: Ledger.post(win | rollback)
```

## Rules (keep these when changing anything)

1. **The server prices the bet.** The client sends the odds it accepted; the server compares
   them with the store's current price: lower → `ODDS_CHANGED` (with current odds), higher →
   taken automatically when `acceptHigherOdds` (default), else `ODDS_CHANGED`. The ticket stores
   the server's odds.
2. **Bettable** = event `scheduled` or `live`, market `open`, selection `active`. Anything else is
   `SELECTION_UNAVAILABLE`. A combo needs 2+ selections from different events (`SAME_EVENT`).
3. **Live delay:** when any selection is live, the request waits `BET_LIVE_DELAY_MS` (3 s) and is
   validated again, so a bet can't be placed on a goal that already happened.
4. **Limits:** stake ≥ 0.10 ₾ and ≤ 20 selections (contracts `BET_LIMITS`); max stake and max
   potential win come from the trading rules (`TradingRules.limitsFor`, sportsbook module:
   competition → sport → `BET_LIMITS` 1 000 ₾ / 100 000 ₾; a combo gets its strictest leg's).
   Then the player's own stake/loss limits for the request's total stake (responsible-gaming
   module): `LIMIT_EXCEEDED` (403) with `limit { kind, period, remaining }`.
5. **Atomic and idempotent:** tickets, selections and the wallet debit commit in one DB
   transaction (`Ledger.post(…, tx)`). Each ticket has `(requestKey, requestIndex)` unique; the
   same `idempotencyKey` again returns the already placed tickets (another player's key →
   `DUPLICATE_REQUEST`). Ledger keys: `sportsbook:bet|win|refund:<ticketId>`.
6. **Settlement rules** (`settlement-rules.ts`), from the final score: 1x2, double chance, totals
   (exactly on the line = void), BTTS, moneyline (a tie = void), spread (push = void), set winner
   (from that set's games; a set not played = void), half-time result (first period score; none
   = void), correct score (exact; `cs_other` = any score outside 0–0…3–3), team totals (that
   team's goals; on the line = void).
7. **Ticket outcome:** any lost selection → **lost** immediately (even with legs still open);
   all resolved → **won** at the product of the non-void odds (rounded down to 2 decimals), or
   **void** when every selection is void (stake refunded as `rollback`). Settled once: the ticket
   row is locked and must still be `open`.
8. Settlement asks the feed (`OddsFeed.result`) instead of listening to live updates, so results
   that came while the API was down are still settled.

## Cash-out

- Offer = `cashoutValue` (contracts, shared with the client): stake × placed odds of the
  non-void legs ÷ current odds of the legs still running × (1 − 5 %), rounded down, capped at the
  potential win. Not offered after a lost leg, while a running leg can't be bet (suspended,
  closed, event gone), when nothing is left running, or below 0.10 ₾.
- Tickets carry `cashout` (offer when read) and, per unresolved selection, `currentOdds`.
- `POST /sportsbook/bets/:id/cashout { amount }`: the player's own open ticket; live legs → the
  same `BET_LIVE_DELAY_MS`, then in one transaction: lock the ticket (must still be `open`),
  price again; lower than `amount` → `CASHOUT_CHANGED` (with the new `cashout`), higher → paid.
  Ledger `cashout` (`sportsbook:cashout:<id>`), ticket → `cashed_out` with `payout`. Settlement
  leaves it alone (only `open` tickets settle). The dashboard counts cash-outs as payouts.

## Liability (backoffice)

`liability.ts` (pure) over the unresolved selections of open tickets: per selection the singles
(count, stake, payout) and combos (count, full potential win: worst case), and `net` = the
market's single stakes − what that selection would pay. Event `worstCase` = sum over markets of
the worst loss. `GET /admin/sportsbook/liability?eventIds=a,b` (totals) and
`/admin/sportsbook/liability/:eventId` (per market), risk role.

## Endpoints

| Method | Path                                             | Auth                   | Notes                                                                                              |
| ------ | ------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| POST   | `/sportsbook/bets`                               | player                 | `PlaceBetsRequest` → `{ tickets, balance }`; errors `{ code, message, selections? }`               |
| GET    | `/sportsbook/bets`                               | player                 | `TicketsPage`, newest first, `?status=open\|settled&page`                                          |
| POST   | `/sportsbook/bets/:id/cashout`                   | player                 | `{ amount }` → `{ ticket, balance }`; `CASHOUT_CHANGED` / `CASHOUT_UNAVAILABLE`                    |
| GET    | `/admin/bets`                                    | support, risk, finance | `AdminTicketsPage` (with player contact), `?status&sport&playerId&page`                            |
| GET    | `/admin/bets/:id`                                | support, risk, finance | `AdminTicket`                                                                                      |
| POST   | `/admin/bets/:id/void`                           | risk                   | `{ reason }`: open tickets only; stake refunded (`sportsbook:refund:<id>`), audit-logged           |
| POST   | `/admin/bets/:id/selections/:selectionId/settle` | risk                   | `{ result, reason }`: unresolved selections only, then the ticket settles if decided; audit-logged |

## Not yet

Partial cash-out, auto cash-out rules, bet builder / same-game combos, system bets, per-player limits, re-settling an already settled ticket (needs reversing the payout),
early settlement of markets decided before full time (e.g. over 1.5 after two goals).

## Bonus money

Placement debits each ticket with `Ledger.postStake` (cash first, then bonus money) and stores
`bet_tickets.bonus_stake`. Wins, voids, refunds and cash-outs pay back in the stake's proportions
(`payoutLegs` + `bonusShare`). Balances in responses are playable (cash + bonus).
