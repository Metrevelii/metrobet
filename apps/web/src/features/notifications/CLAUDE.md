# Notifications (web)

`PlayerLive` (client, renders nothing) opens the player's live channel
(`apps/api/src/modules/player-live`) for signed-in players. It is mounted once, by
`HeaderAccount`, only when someone is signed in.

- **Auth:** Socket.IO's `auth` callback calls the `playerSocketPass` Server Action on every
  (re)connect; the browser never sees the session token, only a one-time pass.
- `balance` → `setLiveBalance` (header chip, `features/wallet/live-balance`).
- `ticket:settled` → toast: won (success, payout), void (info, refund), lost (info), each with
  "My bets". On `/bets` the page also refreshes; elsewhere it doesn't (refreshing a game page
  would relaunch the game).
- Texts: `Notifications.*` in all three locales.
