# Originals module (api)

**Metrobet Originals**, our in-house game studio: the game **server** for Supra Fortune (slot)
and the crash games Metro Jet and Longshot (Longshot was ported from the Skyforge repo). Game clients are native web components (`apps/web/src/features/originals`).
The studio is treated like an external provider: **it never touches the ledger**. Every money
movement goes through the signed game wallet API over HTTP (`GameWalletClient`), so swapping in
a real aggregator changes nothing here.

## Pieces

| File                         | What                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `originals.aggregator.ts`    | Catalogue source (provider `metrobet-originals`, games `originals:<game>`), merged by casino's `CombinedAggregator`; launch |
| `originals.gateway.ts`       | Socket.IO `/originals`: auth by launch token, slot spin, crash join/bet/cancel/cash-out (per `game`), pushes                |
| `originals.controller.ts`    | Cover art SVGs; `play/:game` redirects a directly opened launch URL to the site                                             |
| `wallet/originals-wallet.ts` | Port used by both games: real token → game wallet API, `demo_` token → `DemoWallet`                                         |
| `wallet/demo-wallet.ts`      | Play money (1 000 ₾) in memory, same rules (idempotent ids, no overspend)                                                   |
| `supra-fortune/`             | Spin: CSPRNG stops → `supraWins` (contracts) → bet, win (0 closes a lost round), rollback if the bet's outcome is unknown   |
| `crash/crash-engine.ts`      | One crash game: round state machine, bets, cash-outs, settle/refund                                                         |
| `crash/crash.service.ts`     | One engine per `CRASH_GAMES` entry, the shared loop, reconciliation                                                         |
| `crash/crash-fairness.ts`    | Seeds and provably fair crash points                                                                                        |

Game rules shared with the client (paytable, strips, paylines, multiplier curve, socket event
names and payloads) live in contracts `originals/*`. Never duplicate them here.

## Launch and sessions

Launch URL: `<API_PUBLIC_URL>/api/originals/play/<game>?session=…&mode=…&lang=…`. The site parses
it (`parseOriginalLaunch`) and renders the native client instead of an iframe. Real mode: the
token is the casino game session (`casino_game_sessions`); demo: a `DemoWallet` token minted at
launch. The socket checks the token with a `balance` call before accepting any message.

## Crash games (Metro Jet, Longshot)

All crash games run the **same engine and rules**; only the client's picture differs. Add a crash
game: append it to contracts `CRASH_GAMES` (and the `crash_game` DB enum via a migration), add a
catalogue entry and art here, and a stage component on the web.

- Each game has its own shared round: `betting` (6 s) → `flying` → `crashed` (3 s pause).
  `CrashService.advance(now)` drives every engine: a 100 ms loop when `ORIGINALS_CRASH_LOOP=on`
  (default), by hand in e2e tests (`off`). Socket rooms are per game (`crash:<game>`); every
  crash message carries `game`.
- **Provably fair:** a new random seed per round; `seedHash` is public from the start, the seed is
  revealed at the crash. Crash point = `crashPointFromUniform(first 52 bits of
HMAC-SHA256(seed, "<game>:<n>") / 2^52)`: P(crash ≥ x) = 0.97 / x, 97 % RTP for any target,
  max 1000×. Rounds are numbered per game.
- **Server clock decides:** cash-out pays `bet × crashMultiplierAt(now − startedAt)` only while
  `now < crashAt`. Auto cash-out at target `t` wins iff `t ≤ crashPoint` (paid exactly `t`).
- Bets only in the betting window (minus 100 ms); one bet per panel (slot 0/1) per player key
  (SHA-256 of the session token). A bet the wallet confirms after take-off is rolled back.
- Wallet ids per bet: `crash-bet:<id>`, `crash-win:<id>` (0 for a loss), `crash-rollback:<id>`,
  round `crash-round:<id>` (one wallet round per bet, since wallet rounds belong to one player).
- **Every bet is stored** (`crash_bets`, rounds in `crash_rounds` with `game`) before calling
  the wallet. Anything not `settled` and not live is finished by `reconcile()` (on boot and
  every minute): rounds cut short by a restart are `void` and their bets refunded; cashed bets
  get their win; lost ones a 0 win. Demo bets that can't be finished after a restart are given
  up (logged).
- `crash_bets.sessionToken` is stored in plain text so reconciliation can call the wallet.
  **Encrypt at rest before production.**

## Supra Fortune

5×3, 10 fixed lines, wild = tamada (substitutes, pays its own run). Strip frequencies
`[6,6,5,5,3,3,2,2]` of 32 on every reel → **RTP 96.27 %**, computed exactly in
`supra-fortune.spec.ts` (each cell is independent with the strip frequencies, so one line's
expectation is the game RTP). Change the paytable or strips → update the spec and the catalogue
`rtp`.

## Not yet

Horizontal scaling (crash game state is in one process: needs a leader + Redis pub/sub), rate
limits on socket actions, round history API for the player, encrypting stored session tokens.
