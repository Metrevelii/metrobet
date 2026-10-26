'use client';

import {
  Alert,
  Button,
  Chip,
  cn,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@metrobet/ui';
import { ArrowRight, Ticket, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/shared/empty-state';

import { marketLabel, selectionLabel } from '../labels';
import { peekSelection, useSelectionsSignature } from '../realtime/live-store';
import { LiveEvents } from '../realtime/live-events';
import {
  acceptOddsChanges,
  type BetslipItem,
  type BetslipMode,
  removeSelection,
  setComboStake,
  setMode,
  setStake,
  useBetslip,
} from './store';

const QUICK_STAKES = [5, 10, 20, 50];

type LiveItem = BetslipItem & { liveOdds: number; changed: boolean; suspended: boolean };

function StakeInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={0.5}
      value={Number.isFinite(value) ? value : ''}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
      aria-label={label}
      className="h-9 text-right tabular"
    />
  );
}

function ItemRow({
  item,
  stake,
  mode,
}: {
  item: LiveItem;
  stake: number | undefined;
  mode: BetslipMode;
}) {
  const t = useTranslations('Betslip');
  const ts = useTranslations('Sports');
  const format = useFormatter();
  const market = { type: item.marketType, line: item.line };
  const money = (value: number) => format.number(value, { style: 'currency', currency: 'GEL' });

  return (
    <li className={cn('flex flex-col gap-2 px-4 py-3', item.suspended && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">
            {selectionLabel(ts, market, { key: item.selectionKey }, item)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{marketLabel(ts, market)}</span>
          <span className="truncate text-xs text-muted-foreground">
            {item.home.name} – {item.away.name}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {item.suspended ? (
            <span className="text-xs font-semibold text-warning">{t('suspended')}</span>
          ) : item.changed ? (
            <span className="flex items-center gap-1 text-sm font-bold tabular">
              <span className="text-xs text-muted-foreground line-through">
                {item.odds.toFixed(2)}
              </span>
              <ArrowRight className="size-3" />
              <span className={item.liveOdds > item.odds ? 'text-odds-up' : 'text-odds-down'}>
                {item.liveOdds.toFixed(2)}
              </span>
            </span>
          ) : (
            <span className="text-sm font-bold tabular">{item.liveOdds.toFixed(2)}</span>
          )}
          <button
            type="button"
            onClick={() => removeSelection(item.selectionId)}
            aria-label={t('remove')}
            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {mode === 'single' && stake !== undefined && (
        <div className="grid grid-cols-2 items-center gap-2">
          <StakeInput
            value={stake}
            onChange={(value) => setStake(item.selectionId, value)}
            label={t('stake')}
          />
          <span className="text-right text-xs text-muted-foreground tabular">
            {money(stake * item.liveOdds)}
          </span>
        </div>
      )}
    </li>
  );
}

/** Betslip contents (used in the desktop rail and the mobile sheet). */
export function Betslip() {
  const t = useTranslations('Betslip');
  const format = useFormatter();
  const slip = useBetslip();
  const ids = slip?.items.map((item) => item.selectionId) ?? [];
  useSelectionsSignature(ids);

  if (slip === null) return <Skeleton className="m-4 h-32" />;
  if (slip.items.length === 0) {
    return <EmptyState icon={Ticket} title={t('empty')} description={t('emptyHint')} />;
  }

  const items: LiveItem[] = slip.items.map((item) => {
    const live = peekSelection(item.selectionId);
    const liveOdds = live?.odds ?? item.odds;
    return {
      ...item,
      liveOdds,
      changed: liveOdds !== item.odds,
      suspended: live ? !live.active || live.marketStatus !== 'open' : false,
    };
  });
  const eventIds = [...new Set(items.map((item) => item.eventId))];
  const combo = slip.mode === 'combo';
  const comboConflict = combo && eventIds.length !== items.length;
  const anyChanged = items.some((item) => item.changed);
  const anySuspended = items.some((item) => item.suspended);
  const totalOdds = items.reduce((product, item) => product * item.liveOdds, 1);
  const totalStake = combo
    ? slip.comboStake
    : items.reduce((sum, item) => sum + (slip.stakes[item.selectionId] ?? 0), 0);
  const potentialWin = combo
    ? slip.comboStake * totalOdds
    : items.reduce((sum, item) => sum + (slip.stakes[item.selectionId] ?? 0) * item.liveOdds, 0);
  const money = (value: number) => format.number(value, { style: 'currency', currency: 'GEL' });

  return (
    <div className="flex flex-col">
      <LiveEvents eventIds={eventIds} />
      {items.length > 1 && (
        <Tabs
          value={slip.mode}
          onValueChange={(value) => setMode(value as BetslipMode)}
          className="px-4 pt-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">{t('single')}</TabsTrigger>
            <TabsTrigger value="combo">{t('combo')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <ul className="divide-y">
        {items.map((item) => (
          <ItemRow
            key={item.selectionId}
            item={item}
            stake={slip.stakes[item.selectionId]}
            mode={slip.mode}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t p-4">
        {comboConflict && <Alert variant="destructive">{t('comboSameEvent')}</Alert>}
        {combo && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('totalOdds')}</span>
              <span className="font-bold tabular">{totalOdds.toFixed(2)}</span>
            </div>
            <StakeInput value={slip.comboStake} onChange={setComboStake} label={t('stake')} />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STAKES.map((stake) => (
                <Chip
                  key={stake}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setComboStake(stake)}
                  selected={slip.comboStake === stake}
                >
                  {stake} ₾
                </Chip>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('totalStake')}</span>
          <span className="font-semibold tabular">{money(totalStake)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('potentialWin')}</span>
          <span className="font-bold text-primary tabular">{money(potentialWin)}</span>
        </div>

        {anyChanged ? (
          <Button onClick={acceptOddsChanges} variant="secondary" className="w-full">
            {t('acceptChanges')}
          </Button>
        ) : (
          <Button className="w-full" disabled>
            {t('placeBet')}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {anySuspended ? t('suspended') : t('loginToBet')}
        </p>
      </div>
    </div>
  );
}
