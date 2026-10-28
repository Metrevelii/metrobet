import { z } from 'zod';

import { GAME_WALLET_ERRORS } from '../casino/game-wallet.js';
import { gameModeSchema } from '../casino/casino.js';

/**
 * Metrobet Originals: our in-house game studio. Its game server runs in the API and settles
 * through the game wallet API like any provider; its game clients are native web components
 * that talk to the game server over Socket.IO.
 */
export const ORIGINALS_PROVIDER_ID = 'metrobet-originals';
export const ORIGINAL_GAMES = ['supra-fortune', 'metro-jet'] as const;
export const originalGameSchema = z.enum(ORIGINAL_GAMES);
export type OriginalGame = z.infer<typeof originalGameSchema>;

/** Launch URLs look like `<api>/api/originals/play/<game>?session=…&mode=…` (see the parser). */
export const ORIGINALS_PLAY_PATH = '/api/originals/play/';

export const originalLaunchSchema = z.object({
  game: originalGameSchema,
  /** Game session token (real) or demo token: identifies the player to the game server. */
  session: z.string().min(1),
  mode: gameModeSchema,
});
export type OriginalLaunch = z.infer<typeof originalLaunchSchema>;

/** Query parameters of a URL (contracts have no DOM/Node `URL`, so parsed by hand). */
function queryParams(query: string): Record<string, string> {
  return Object.fromEntries(
    query
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const [key = '', value = ''] = pair.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' '))];
      }),
  );
}

/** The Originals game behind a launch URL, or null for any other provider's URL. */
export function parseOriginalLaunch(url: string): OriginalLaunch | null {
  const match = /^https?:\/\/[^/?#]+(\/[^?#]*)\??([^#]*)/.exec(url);
  if (!match?.[1]?.startsWith(ORIGINALS_PLAY_PATH)) return null;
  const params = queryParams(match[2] ?? '');
  const launch = originalLaunchSchema.safeParse({
    game: match[1].slice(ORIGINALS_PLAY_PATH.length),
    session: params.session,
    mode: params.mode,
  });
  return launch.success ? launch.data : null;
}

/** Socket.IO namespace; connect with `auth: { session }` (the launch token). */
export const ORIGINALS_WS_NAMESPACE = '/originals';

export const ORIGINALS_WS = {
  /** server → client: `{ balance }` after every change (real or demo money). */
  balance: 'balance',
  /** client → server (ack): Supra Fortune spin `{ bet }` → `OriginalsAck<SupraSpinResult>`. */
  supraSpin: 'supra:spin',
  /** client → server (ack): join Metro Jet → `JetState`. */
  jetJoin: 'jet:join',
  /** server → client: `JetState` for this viewer after each phase change. */
  jetState: 'jet:state',
  /** server → client: public bets of the current round (throttled). */
  jetBets: 'jet:bets',
  /** server → client: this viewer's bets changed (e.g. an auto cash-out). */
  jetMine: 'jet:mine',
  /** client → server (ack): place / cancel / cash out. */
  jetBet: 'jet:bet',
  jetCancel: 'jet:cancel',
  jetCashout: 'jet:cashout',
} as const;

export const ORIGINALS_ERRORS = [
  ...GAME_WALLET_ERRORS,
  /** Betting window closed / not flying. */
  'WRONG_PHASE',
  'ALREADY_BET',
  'NO_BET',
  'UNAVAILABLE',
] as const;
export type OriginalsError = (typeof ORIGINALS_ERRORS)[number];

/** Every ack: `{ ok: true, data }` or `{ ok: false, code }`. */
export type OriginalsAck<T> = { ok: true; data: T } | { ok: false; code: OriginalsError };

export const balanceMessageSchema = z.object({ balance: z.number().int().min(0) });

/** Demo sessions start with this much play money (minor units). */
export const ORIGINALS_DEMO_BALANCE = 1000_00;
