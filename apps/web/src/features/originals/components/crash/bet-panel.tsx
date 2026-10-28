'use client';

import {
  CRASH_MAX_BET,
  CRASH_MIN_BET,
  type CrashMyBet,
  type CrashState,
  crashMultiplierAt,
  ORIGINALS_WS,
  type OriginalsError,
  toMajor,
  toMinor,
} from '@metrobet/contracts';
import { Button, cn, Input, Switch } from '@metrobet/ui';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react';
import type { Socket } from 'socket.io-client';

import { request } from '../../use-originals-socket';
import { useGameError, useMoney } from '../game-shell';
import { useAnimationFrame } from './use-animation-frame';

const QUICK_AMOUNTS = [1, 2, 5, 10];
const clampBet = (minor: number) => Math.min(CRASH_MAX_BET, Math.max(CRASH_MIN_BET, minor));
/** Typed amount (₾) → valid bet in minor units (falls back to the minimum). */
const parseBet = (text: string) => clampBet(toMinor(Number(text.replace(',', '.')) || 0));
const showBet = (minor: number) => toMajor(minor).toFixed(2);

/** Live "Cash out 12.34 ₾" while flying, updated every frame without re-rendering. */
function CashoutLabel({
  bet,
  startedAt,
  offset,
}: {
  bet: CrashMyBet;
  startedAt: number;
  offset: number;
}) {
  const t = useTranslations('Originals.crash');
  const money = useMoney();
  const amount = useRef<HTMLSpanElement>(null);
  useAnimationFrame(() => {
    const multiplier = crashMultiplierAt(Date.now() + offset - startedAt);
    if (amount.current) amount.current.textContent = money(Math.floor(bet.amount * multiplier));
  }, [bet, startedAt, offset]);
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-xs font-semibold uppercase">{t('cashOut')}</span>
      <span ref={amount} className="text-lg font-black tabular" />
    </span>
  );
}

type BetPanelProps = { slot: 0 | 1; state: CrashState; offset: number; socket: Socket | null };

/**
 * One of the two bet panels. Bet → (betting) cancel → (flying) cash out. Outside the betting
 * window a bet is queued and sent when the next round opens. Optional auto cash-out.
 */
export function BetPanel({ slot, state, offset, socket }: BetPanelProps) {
  const t = useTranslations('Originals.crash');
  const errorText = useGameError();
  const money = useMoney();
  const [amountText, setAmountText] = useState(showBet(1_00));
  const amount = parseBet(amountText);
  const setAmount = (minor: number) => setAmountText(showBet(clampBet(minor)));
  const [auto, setAuto] = useState(false);
  const [target, setTarget] = useState('2.00');
  /** The round a queued bet waits for (the next one); it is sent when that round opens. */
  const [queuedFor, setQueuedFor] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<OriginalsError | null>(null);
  const { round } = state;
  const queued = queuedFor !== null && queuedFor > round.number;
  const mine = state.mine.find((bet) => bet.slot === slot) ?? null;
  const autoCashout = auto ? Number(target) : null;
  const autoValid = autoCashout === null || (autoCashout >= 1.01 && autoCashout <= 1000);
  const locked = pending || mine?.status === 'placed' || queued;

  const send = (event: string, payload: object) =>
    startTransition(async () => {
      if (!socket) return;
      const ack = await request<unknown>(socket, event, payload);
      setError(ack.ok ? null : ack.code);
    });
  const placeBet = () =>
    send(ORIGINALS_WS.crashBet, { game: state.game, slot, amount, autoCashout });

  // A queued bet goes out as soon as its round opens for betting.
  const sendQueued = useEffectEvent(placeBet);
  useEffect(() => {
    if (queuedFor === round.number && round.phase === 'betting') sendQueued();
  }, [queuedFor, round.number, round.phase]);

  let action: React.ReactNode;
  if (mine?.status === 'placed' && round.phase === 'flying') {
    action = (
      <Button
        className="h-16 w-full bg-warning text-on-status hover:bg-warning/90"
        disabled={pending}
        onClick={() => send(ORIGINALS_WS.crashCashout, { game: state.game, slot })}
      >
        <CashoutLabel bet={mine} startedAt={round.startedAt!} offset={offset} />
      </Button>
    );
  } else if (mine?.status === 'placed') {
    action = (
      <Button
        variant="destructive"
        className="h-16 w-full text-base font-bold"
        disabled={pending}
        onClick={() => send(ORIGINALS_WS.crashCancel, { game: state.game, slot })}
      >
        {t('cancel')}
      </Button>
    );
  } else if (queued) {
    action = (
      <Button
        variant="secondary"
        className="h-16 w-full flex-col gap-0"
        onClick={() => setQueuedFor(null)}
      >
        <span className="text-xs text-muted-foreground">{t('waiting')}</span>
        <span className="font-bold">{t('cancel')}</span>
      </Button>
    );
  } else {
    const now = round.phase === 'betting' && !(mine?.status === 'cashed');
    action = (
      <Button
        className="h-16 w-full flex-col gap-0"
        disabled={pending || !autoValid || !socket}
        onClick={() => (now ? placeBet() : setQueuedFor(round.number + 1))}
      >
        <span className="text-xs font-semibold uppercase">{now ? t('bet') : t('betNext')}</span>
        <span className="text-lg font-black tabular">{money(amount)}</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-background/70 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('less')}
              disabled={locked}
              onClick={() => setAmount(amount - 1_00)}
            >
              <Minus />
            </Button>
            <Input
              inputMode="decimal"
              aria-label={t('amount')}
              className="h-8 border-0 bg-transparent text-center font-bold tabular"
              disabled={locked}
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              onBlur={() => setAmount(amount)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('more')}
              disabled={locked}
              onClick={() => setAmount(amount + 1_00)}
            >
              <Plus />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {QUICK_AMOUNTS.map((quick) => (
              <button
                key={quick}
                type="button"
                disabled={locked}
                className="rounded-md bg-background/70 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() => setAmount(toMinor(quick))}
              >
                {quick}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-[45%] items-stretch">{action}</div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Switch checked={auto} disabled={locked} onCheckedChange={setAuto} aria-label={t('auto')} />
        <span className="font-semibold text-muted-foreground">{t('auto')}</span>
        <Input
          inputMode="decimal"
          aria-label={t('autoTarget')}
          aria-invalid={!autoValid || undefined}
          disabled={!auto || locked}
          className="ml-auto h-7 w-20 text-right tabular"
          value={target}
          onChange={(event) => setTarget(event.target.value.replace(',', '.'))}
        />
        <span className="text-muted-foreground">×</span>
      </div>

      <p
        className={cn('min-h-4 text-xs', error ? 'text-destructive' : 'text-success')}
        aria-live="polite"
      >
        {error
          ? errorText(error)
          : mine?.status === 'cashed'
            ? t('cashedOut', { multiplier: mine.cashedAt!.toFixed(2), amount: money(mine.win) })
            : ''}
      </p>
    </div>
  );
}
