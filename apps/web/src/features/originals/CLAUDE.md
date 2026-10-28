# Originals (web)

Native game clients for **Metrobet Originals** (our studio): Supra Fortune (slot) and Metro Jet
(crash). The game server is `apps/api/src/modules/originals` (see its CLAUDE.md for the rules).

## How they are launched

The casino launcher (`/slots/play/[game]`) gets a launch URL as for any game. If
`parseOriginalLaunch(url)` recognises it, `GameFrame` renders `<OriginalGame launch>` in the
stage instead of an iframe. The launch token (`launch.session`) identifies the player to the game
server; real mode is the player's casino game session, demo mode a play-money session.

## Data flow

```
useOriginalsSocket(launch) ── Socket.IO /originals (auth: { session }) ── game server
   balance events → GameShell; real mode → setLiveBalance (header)
SupraFortune: request(supra:spin) → animate reels → show result + balance
MetroJet: useJet → jet:join + jet:state / jet:bets / jet:mine → JetStage, BetPanel ×2, LiveBets
```

- Everything the server decides (stops, wins, crash point, cash-out multiplier) comes from it; the
  client only animates. Shared rules (`supraGrid`, `SUPRA_PAYLINES`, `jetMultiplierAt`…) come
  from contracts so the picture always matches the server.
- `request()` wraps `emitWithAck` with a timeout; failures read as `UNAVAILABLE`. Error codes are
  translated by `useGameError()` (`Originals.errors.*`).
- **Clock:** Metro Jet states carry `serverTime`; `offset = serverTime − Date.now()` keeps every
  viewer's multiplier in step. Per-frame drawing (`JetStage`, `CashoutLabel`) uses refs inside
  `useAnimationFrame`, never React state, so the page doesn't re-render 60 times a second.
- Supra Fortune shows the bet as taken immediately and reveals the new balance only after the
  reels stop (the ack carries it; other tabs get a `balance` push).
- Bet panels follow the Aviator flow: bet → cancel (betting) → cash out (flying); outside the
  betting window a bet is **queued** for the next round (`queuedFor` = next round number, sent
  by an effect when that round opens). Auto cash-out is sent with the bet.

## Not yet

Sounds, a big-win celebration, round history/details dialog with seed verification in the
browser, mobile layout tuning in landscape, keyboard shortcuts (space = bet/cash out).
