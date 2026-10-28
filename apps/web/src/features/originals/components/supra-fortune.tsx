'use client';

import {
  ORIGINALS_WS,
  type OriginalLaunch,
  type OriginalsError,
  SUPRA_BETS,
  SUPRA_PAYLINES,
  SUPRA_PAYS,
  SUPRA_ROWS,
  SUPRA_STRIPS,
  SUPRA_SYMBOLS,
  SUPRA_WILD,
  supraGrid,
  type SupraSpinResult,
} from '@metrobet/contracts';
import { Button, cn } from '@metrobet/ui';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SUPRA_ART } from '../symbols';
import { request, useOriginalsSocket } from '../use-originals-socket';
import { GameShell, useGameError, useMoney } from './game-shell';

const MIN_SPIN_MS = 650;
const REEL_STOP_GAP_MS = 170;
const BIG_WIN_FACTOR = 10;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const art = (symbol: number) => SUPRA_ART[SUPRA_SYMBOLS[symbol]!];

/** Cells (`reel:row`) on winning lines, counting only the reels that paid. */
function winningCells(result: SupraSpinResult | null): Set<string> {
  const cells = new Set<string>();
  for (const win of result?.wins ?? []) {
    SUPRA_PAYLINES[win.line]!.slice(0, win.count).forEach((row, reel) =>
      cells.add(`${reel}:${row}`),
    );
  }
  return cells;
}

function Reel({
  reel,
  symbols,
  spinning,
  highlighted,
}: {
  reel: number;
  symbols: number[];
  spinning: boolean;
  highlighted: Set<string>;
}) {
  const cell = 'flex aspect-square items-center justify-center text-[clamp(1.75rem,6vw,3.25rem)]';
  return (
    <div className="relative overflow-hidden rounded-lg bg-background/60 ring-1 ring-border">
      {/* In-flow spacer: the reel is exactly three cells tall; the content is laid over it. */}
      <div className="invisible" aria-hidden>
        {Array.from({ length: SUPRA_ROWS }, (_, i) => (
          <div key={i} className={cell} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-0">
        {spinning ? (
          <div className="animate-scroll-y blur-[1.5px] [--scroll-duration:0.45s] motion-reduce:animate-none">
            {[...SUPRA_STRIPS[reel]!, ...SUPRA_STRIPS[reel]!].map((symbol, i) => (
              <div key={i} className={cell} aria-hidden>
                {art(symbol)}
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-settle motion-reduce:animate-none">
            {symbols.map((symbol, row) => (
              <div
                key={row}
                className={cn(
                  cell,
                  'transition-colors',
                  highlighted.has(`${reel}:${row}`) &&
                    'rounded-md bg-primary/20 ring-2 ring-primary ring-inset',
                )}
              >
                {art(symbol)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Supra Fortune: 5×3 slot, 10 lines. The server picks the stops; the reels only show them. */
export function SupraFortune({ launch }: { launch: OriginalLaunch }) {
  const t = useTranslations('Originals.supra');
  const errorText = useGameError();
  const money = useMoney();
  const connection = useOriginalsSocket(launch);
  const [betIndex, setBetIndex] = useState(SUPRA_BETS.indexOf(1_00));
  const [stops, setStops] = useState([0, 4, 8, 12, 16]);
  /** Reels still spinning (from the right): 5 = all, 0 = stopped. */
  const [spinningReels, setSpinningReels] = useState(0);
  const [result, setResult] = useState<SupraSpinResult | null>(null);
  const [error, setError] = useState<OriginalsError | null>(null);
  const [paytable, setPaytable] = useState(false);
  const bet = SUPRA_BETS[betIndex]!;
  const busy = spinningReels > 0;
  const grid = supraGrid(stops);
  const highlighted = busy ? new Set<string>() : winningCells(result);

  const spin = async () => {
    const { socket, balance } = connection;
    if (!socket || busy) return;
    setError(null);
    setResult(null);
    setSpinningReels(SUPRA_STRIPS.length);
    if (balance !== null && balance >= bet) connection.updateBalance(balance - bet);
    const started = Date.now();
    const ack = await request<SupraSpinResult>(socket, ORIGINALS_WS.supraSpin, { bet });
    await wait(Math.max(0, MIN_SPIN_MS - (Date.now() - started)));
    if (!ack.ok) {
      setSpinningReels(0);
      setError(ack.code);
      if (balance !== null) connection.updateBalance(balance);
      return;
    }
    setStops(ack.data.stops);
    for (let left = SUPRA_STRIPS.length - 1; left >= 0; left--) {
      setSpinningReels(left);
      if (left > 0) await wait(REEL_STOP_GAP_MS);
    }
    setResult(ack.data);
    connection.updateBalance(ack.data.balance);
  };

  return (
    <GameShell title="Supra Fortune" mode={launch.mode} connection={connection}>
      <div className="relative mx-auto w-full max-w-2xl rounded-2xl bg-gradient-to-b from-primary/15 to-transparent p-2 ring-1 ring-primary/30 sm:p-3">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {grid.map((symbols, reel) => (
            <Reel
              key={reel}
              reel={reel}
              symbols={symbols}
              spinning={reel >= SUPRA_STRIPS.length - spinningReels}
              highlighted={highlighted}
            />
          ))}
        </div>
      </div>

      <div
        className="flex min-h-12 flex-col items-center justify-center text-center"
        aria-live="polite"
      >
        {result && result.win > 0 ? (
          <p
            className={cn(
              'animate-settle font-black text-primary tabular',
              result.win >= bet * BIG_WIN_FACTOR ? 'text-3xl' : 'text-xl',
            )}
          >
            {result.win >= bet * BIG_WIN_FACTOR && <span className="mr-2">{t('bigWin')}</span>}
            {t('win', { amount: money(result.win) })}
          </p>
        ) : error ? (
          <p className="text-sm font-semibold text-destructive">{errorText(error)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{result ? t('noWin') : t('hint')}</p>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('lessBet')}
            disabled={busy || betIndex === 0}
            onClick={() => setBetIndex((i) => i - 1)}
          >
            <Minus />
          </Button>
          <div className="min-w-24 text-center">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase">
              {t('totalBet')}
            </div>
            <div className="font-bold tabular">{money(bet)}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('moreBet')}
            disabled={busy || betIndex === SUPRA_BETS.length - 1}
            onClick={() => setBetIndex((i) => i + 1)}
          >
            <Plus />
          </Button>
        </div>
        <Button
          size="lg"
          className="min-w-40 text-base font-black"
          disabled={busy || connection.status !== 'ready'}
          onClick={() => void spin()}
        >
          {busy ? t('spinning') : t('spin')}
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          aria-expanded={paytable}
          onClick={() => setPaytable((open) => !open)}
        >
          {t('paytable')}
          <ChevronDown className={cn('size-4 transition-transform', paytable && 'rotate-180')} />
        </button>
        {paytable && (
          <div className="mt-2 flex flex-col gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">{t('rules')}</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUPRA_SYMBOLS.map((symbol, index) => (
                <li
                  key={symbol}
                  className="flex items-center gap-2 rounded-md bg-background/60 p-2"
                >
                  <span className="text-2xl" aria-hidden>
                    {SUPRA_ART[symbol]}
                  </span>
                  <span className="flex flex-col text-xs tabular">
                    <span className="font-semibold">
                      {t(`symbols.${symbol}`)}
                      {index === SUPRA_WILD && ` · ${t('wild')}`}
                    </span>
                    {SUPRA_PAYS[index]!.map((pay, i) => (
                      <span key={i} className="text-muted-foreground">
                        {i + 3}× {money(Math.round((pay * bet) / SUPRA_PAYLINES.length))}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GameShell>
  );
}
