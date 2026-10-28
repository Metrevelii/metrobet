# Originals (web)

Native game clients for **Metrobet Originals** (our studio): Supra Fortune (slot) and the crash
games Metro Jet and Longshot. The game server is `apps/api/src/modules/originals` (see its CLAUDE.md for the rules).

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
CrashGame(game, Stage): useCrash → crash:join + crash:state / crash:bets / crash:mine (by game)
   → History, <Stage round offset> (JetStage | LongshotStage), BetPanel ×2, LiveBets, Fairness
```

- Everything the server decides (stops, wins, crash point, cash-out multiplier) comes from it; the
  client only animates. Shared rules (`supraGrid`, `SUPRA_PAYLINES`, `crashMultiplierAt`…) come
  from contracts so the picture always matches the server.
- `request()` wraps `emitWithAck` with a timeout; failures read as `UNAVAILABLE`. Error codes are
  translated by `useGameError()` (`Originals.errors.*`).
- **Crash games share everything but the picture:** `crash/` holds the screen, bet panels,
  history, live bets and fairness; a game only supplies a `Stage` (`CrashStageProps`: round +
  clock offset). Texts: shared in `Originals.crash`, per game in `Originals.metroJet` /
  `Originals.longshot`.
- **Clock:** crash states carry `serverTime`; `offset = serverTime − Date.now()` keeps every
  viewer's multiplier in step. Per-frame drawing (`JetStage`, the Longshot overlay, `CashoutLabel`) uses refs inside
  `useAnimationFrame`, never React state, so the page doesn't re-render 60 times a second.
- Supra Fortune shows the bet as taken immediately and reveals the new balance only after the
  reels stop (the ack carries it; other tabs get a `balance` push).
- Bet panels follow the Aviator flow: bet → cancel (betting) → cash out (flying); outside the
  betting window a bet is **queued** for the next round (`queuedFor` = next round number, sent
  by an effect when that round opens). Auto cash-out is sent with the bet.

## Longshot (`components/longshot/`)

Ported from the Skyforge repo (`games/longshot`): a ballista on a castle wall winds up during
betting, fires a bolt at take-off, the camera follows it through the clouds, and at the crash a
dragon burns it. Pixi.js 8, loaded only in the browser (dynamic import in `LongshotStage`).

- **State-driven:** `sceneFrame(round, serverNow)` (`frame.ts`) turns the round into a frame;
  `scene.render(frame)` draws only from it, so joining mid-round just works. The stage reads the
  latest round from a ref each tick, so new states never restart Pixi.
- **Theme:** `readPalette()` turns the design tokens (`--color-*`, read inside `data-mode="dark"`)
  into scene colours: sky, hills, wall, rim, clouds, fletching and trail follow the theme. The
  dragon, fire, wood and iron keep their art colours (`art.ts`).
- Multiplier, countdown and "Burned!" are HTML over the canvas, like the other stages.
- `art.ts` / `scene.ts` disable `unicorn/no-array-fill-with-reference-type`: it mistakes Pixi's
  `Graphics.fill()` for `Array.prototype.fill()`.

## Not yet

Sounds, a big-win celebration, round history/details dialog with seed verification in the
browser, mobile layout tuning in landscape, keyboard shortcuts (space = bet/cash out).
