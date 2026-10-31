'use client';

import { toMajor, toMinor } from '@metrobet/contracts';
import { Alert, Button, Checkbox, cn, Input, Skeleton } from '@metrobet/ui';
import { ArrowRight, CircleCheck, Minus, Plus, Ticket, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { useSignedIn } from '@/features/auth/session-store';
import { currentBalance } from '@/features/wallet/actions';
import { setLiveBalance } from '@/features/wallet/live-balance';
import { Link, useRouter } from '@/i18n/navigation';

import { type PlaceBetsError, placeBets } from '../bets/actions';
import { BETS_HREF } from '../bets/links';
import { marketLabel, selectionLabel } from '../labels';
import { LiveEvents } from '../realtime/live-events';
import { peekSelection, useSelectionsSignature } from '../realtime/live-store';
import {
  acceptOddsChanges,
  type BetslipItem,
  type BetslipMode,
  clearBetslip,
  removeSelection,
  setAcceptAll,
  setAcceptHigher,
  setMode,
  setStake,
  useBetslip,
} from './store';

/** − / + step for the stake, in ₾. */
const STAKE_STEP = 1;

/** Message key for a placement error (a duplicate request reads as a generic failure). */
const errorKey = (error: PlaceBetsError) =>
  `errors.${error === 'DUPLICATE_REQUEST' ? 'failed' : error}` as const;

type LiveItem = BetslipItem & {
  liveOdds: number;
  /** The odds this item would be placed at. */
  placeOdds: number;
  /** The live price moved in a way that needs the player's OK before placing. */
  blocking: boolean;
  suspended: boolean;
};

/** Shown after a successful placement (the slip is cleared). */
function Placed({ count, onDone }: { count: number; onDone: () => void }) {
  const t = useTranslations('Betslip');
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
        <CircleCheck className="size-6" />
      </div>
      <p className="text-sm font-semibold">{t('placed', { count })}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={BETS_HREF}>{t('viewBets')}</Link>
        </Button>
        <Button size="sm" onClick={onDone}>
          {t('done')}
        </Button>
      </div>
    </div>
  );
}

/** Accumulator / Singles, as underlined tabs. Accumulator needs two selections. */
function ModeTabs({ mode, count }: { mode: BetslipMode; count: number }) {
  const t = useTranslations('Betslip');
  return (
    <div role="tablist" className="grid grid-cols-2 border-b">
      {(['combo', 'single'] as const).map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={mode === item}
          disabled={item === 'combo' && count < 2}
          onClick={() => setMode(item)}
          className={cn(
            '-mb-px cursor-pointer border-b-2 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            mode === item
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t(item)}
        </button>
      ))}
    </div>
  );
}

/** One numbered selection: match, market, pick and the odds pill. */
function ItemRow({ item, index }: { item: LiveItem; index: number }) {
  const t = useTranslations('Betslip');
  const ts = useTranslations('Sports');
  const market = { type: item.marketType, line: item.line };
  const moved = item.liveOdds !== item.odds;

  return (
    <li className={cn('relative flex gap-3 px-4 py-3', item.suspended && 'opacity-60')}>
      <span className="w-4 shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground tabular">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-5">
        <span className="truncate text-sm font-bold">
          {item.home.name} – {item.away.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">{marketLabel(ts, market)}</span>
        <span className="truncate text-xs font-semibold text-primary">
          {selectionLabel(ts, market, { key: item.selectionKey }, item, true)}
        </span>
      </div>
      <div className="flex flex-col items-end justify-end">
        {item.suspended ? (
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-warning">
            {t('suspended')}
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular',
              item.blocking ? 'bg-warning/15 ring-1 ring-warning' : 'bg-muted',
            )}
          >
            {moved && (
              <>
                <span className="text-xs font-normal text-muted-foreground line-through">
                  {item.odds.toFixed(2)}
                </span>
                <ArrowRight className="size-3" />
              </>
            )}
            <span
              className={cn(
                moved && (item.liveOdds > item.odds ? 'text-odds-up' : 'text-odds-down'),
              )}
            >
              {item.liveOdds.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => removeSelection(item.selectionId)}
        aria-label={t('remove')}
        className="absolute top-2.5 right-3 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

/** Stake row: ALL (whole balance), −, +, and the amount in ₾. */
function StakeControl({ stake, disabled }: { stake: number; disabled: boolean }) {
  const t = useTranslations('Betslip');
  const [text, setText] = useState<string | null>(null);
  const [loadingAll, startAll] = useTransition();
  const shown = text ?? stake.toFixed(2);

  const commit = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    setStake(Number.isFinite(parsed) ? parsed : 0);
    setText(null);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-auto text-sm text-muted-foreground">{t('stake')}</span>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 px-2.5 text-xs font-bold"
        disabled={disabled || loadingAll}
        onClick={() =>
          startAll(async () => {
            const balance = await currentBalance();
            if (balance !== null) setStake(toMajor(balance));
          })
        }
      >
        {t('all')}
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="size-9"
        aria-label={t('less')}
        disabled={disabled || stake <= 0}
        onClick={() => setStake(Math.max(0, stake - STAKE_STEP))}
      >
        <Minus />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="size-9"
        aria-label={t('more')}
        disabled={disabled}
        onClick={() => setStake(stake + STAKE_STEP)}
      >
        <Plus />
      </Button>
      <div className="relative w-24">
        <Input
          inputMode="decimal"
          aria-label={t('stake')}
          disabled={disabled}
          value={shown}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && commit(event.currentTarget.value)}
          className="h-9 pr-6 text-right font-bold tabular"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-muted-foreground">
          ₾
        </span>
      </div>
    </div>
  );
}

function Preference({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground">
        {label}
      </label>
    </div>
  );
}

/** Betslip contents (desktop rail and mobile sheet), laid out like a classic Georgian bookmaker. */
export function Betslip() {
  const t = useTranslations('Betslip');
  const format = useFormatter();
  const slip = useBetslip();
  const signedIn = useSignedIn();
  const router = useRouter();
  const [placing, startPlacing] = useTransition();
  const [placed, setPlaced] = useState<number | null>(null);
  const [error, setError] = useState<PlaceBetsError | null>(null);
  const ids = slip?.items.map((item) => item.selectionId) ?? [];
  useSelectionsSignature(ids);

  if (placed !== null && slip?.items.length === 0) {
    return <Placed count={placed} onDone={() => setPlaced(null)} />;
  }
  if (slip === null) return <Skeleton className="m-4 h-32" />;
  if (slip.items.length === 0) {
    return <EmptyState icon={Ticket} title={t('empty')} description={t('emptyHint')} />;
  }

  const items: LiveItem[] = slip.items.map((item) => {
    const live = peekSelection(item.selectionId);
    const liveOdds = live?.odds ?? item.odds;
    const lower = liveOdds < item.odds;
    const higher = liveOdds > item.odds;
    return {
      ...item,
      liveOdds,
      placeOdds: slip.acceptAll ? liveOdds : item.odds,
      blocking: !slip.acceptAll && (lower || (higher && !slip.acceptHigher)),
      suspended: live ? !live.active || live.marketStatus !== 'open' : false,
    };
  });
  const eventIds = [...new Set(items.map((item) => item.eventId))];
  const combo = slip.mode === 'combo';
  const comboConflict = combo && eventIds.length !== items.length;
  const anyBlocking = items.some((item) => item.blocking);
  const anySuspended = items.some((item) => item.suspended);
  const totalOdds = items.reduce((product, item) => product * item.liveOdds, 1);
  const totalStake = combo ? slip.stake : slip.stake * items.length;
  const potentialWin = combo
    ? slip.stake * totalOdds
    : items.reduce((sum, item) => sum + slip.stake * item.liveOdds, 0);
  const money = (value: number) => format.number(value, { style: 'currency', currency: 'GEL' });
  const canPlace =
    signedIn === true && !anySuspended && !comboConflict && slip.stake > 0 && !placing;

  // The server re-prices: it refuses a lower price and takes a higher one when allowed.
  const place = () =>
    startPlacing(async () => {
      const stake = toMinor(slip.stake);
      const result = await placeBets({
        idempotencyKey: crypto.randomUUID(),
        mode: slip.mode,
        selections: items.map((item) => ({ selectionId: item.selectionId, odds: item.placeOdds })),
        stakes: combo ? [stake] : items.map(() => stake),
        acceptHigherOdds: slip.acceptHigher || slip.acceptAll,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      clearBetslip();
      setPlaced(result.data.tickets.length);
      setLiveBalance(result.data.balance);
      router.refresh();
    });

  return (
    <div className="flex flex-col">
      <LiveEvents eventIds={eventIds} />
      <ModeTabs mode={slip.mode} count={items.length} />

      <ol className="divide-y">
        {items.map((item, index) => (
          <ItemRow key={item.selectionId} item={item} index={index} />
        ))}
      </ol>

      <div className="flex flex-col gap-3 border-t bg-muted/30 p-4">
        {comboConflict && <Alert variant="destructive">{t('comboSameEvent')}</Alert>}
        {combo && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t('totalOdds')}</span>
            <span className="text-xl font-black tabular">{totalOdds.toFixed(2)}</span>
          </div>
        )}
        <StakeControl stake={slip.stake} disabled={placing} />
        {!combo && items.length > 1 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t('totalStake')}</span>
            <span className="font-semibold tabular">{money(totalStake)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{t('potentialWin')}</span>
          <span className="text-2xl font-black text-primary tabular">{money(potentialWin)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t px-4 py-3">
        <Preference
          checked={slip.acceptHigher}
          onChange={setAcceptHigher}
          label={t('acceptHigher')}
        />
        <Preference checked={slip.acceptAll} onChange={setAcceptAll} label={t('acceptAll')} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {error && (
          <Alert variant="destructive" aria-live="polite">
            {t(errorKey(error))}
            {error === 'INSUFFICIENT_FUNDS' && (
              <>
                {' '}
                <Link href="/wallet" className="font-semibold underline">
                  {t('topUp')}
                </Link>
              </>
            )}
          </Alert>
        )}
        {anyBlocking ? (
          <Button
            size="lg"
            variant="secondary"
            className="h-12 w-full text-base font-bold"
            onClick={() => {
              acceptOddsChanges();
              setError(null);
            }}
          >
            {t('acceptChanges')}
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 w-full text-base font-black"
            disabled={!canPlace}
            onClick={place}
          >
            {placing ? t('placing') : t('placeBet')}
          </Button>
        )}
        {(anySuspended || signedIn === false) && (
          <p className="text-center text-xs text-muted-foreground">
            {anySuspended ? (
              t('suspended')
            ) : (
              <Link href="/login" className="font-semibold text-primary hover:underline">
                {t('loginToBet')}
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
