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
4. **Limits** (contracts `BET_LIMITS`): stake 0.10–1 000 ₾ per ticket, potential win ≤ 100 000 ₾,
   ≤ 20 selections.
5. **Atomic and idempotent:** tickets, selections and the wallet debit commit in one DB
   transaction (`Ledger.post(…, tx)`). Each ticket has `(requestKey, requestIndex)` unique; the
   same `idempotencyKey` again returns the already placed tickets (another player's key →
   `DUPLICATE_REQUEST`). Ledger keys: `sportsbook:bet|win|refund:<ticketId>`.
6. **Settlement rules** (`settlement-rules.ts`), from the final score: 1x2, double chance, totals
   (exactly on the line = void), BTTS, moneyline (a tie = void), spread (push = void), set winner
   (from that set's games; a set not played = void).
7. **Ticket outcome:** any lost selection → **lost** immediately (even with legs still open);
   all resolved → **won** at the product of the non-void odds (rounded down to 2 decimals), or
   **void** when every selection is void (stake refunded as `rollback`). Settled once: the ticket
   row is locked and must still be `open`.
8. Settlement asks the feed (`OddsFeed.result`) instead of listening to live updates, so results
   that came while the API was down are still settled.

## Endpoints

| Method | Path                                             | Auth                   | Notes                                                                                              |
| ------ | ------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| POST   | `/sportsbook/bets`                               | player                 | `PlaceBetsRequest` → `{ tickets, balance }`; errors `{ code, message, selections? }`               |
| GET    | `/sportsbook/bets`                               | player                 | `TicketsPage`, newest first, `?status=open\|settled&page`                                          |
| GET    | `/admin/bets`                                    | support, risk, finance | `AdminTicketsPage` (with player contact), `?status&sport&playerId&page`                            |
| GET    | `/admin/bets/:id`                                | support, risk, finance | `AdminTicket`                                                                                      |
| POST   | `/admin/bets/:id/void`                           | risk                   | `{ reason }`: open tickets only; stake refunded (`sportsbook:refund:<id>`), audit-logged           |
| POST   | `/admin/bets/:id/selections/:selectionId/settle` | risk                   | `{ result, reason }`: unresolved selections only, then the ticket settles if decided; audit-logged |

## Not yet

Cash-out, bet builder / same-game combos, system bets, per-player limits and risk management
(liability per selection), re-settling an already settled ticket (needs reversing the payout),
early settlement of markets decided before full time (e.g. over 1.5 after two goals).
