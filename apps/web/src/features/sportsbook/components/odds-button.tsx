'use client';

import type { EventSummary, Market, Selection } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';

import { toggleSelection, useInBetslip } from '../betslip/store';
import { useSelectionLiveState } from '../realtime/live-store';

type OddsButtonProps = {
  event: Pick<EventSummary, 'id' | 'sport' | 'home' | 'away'>;
  market: Market;
  selection: Selection;
  label: string;
  className?: string;
};

/**
 * A price. Updates live, flashes green/red with an arrow when it moves, locks while the market
 * is suspended or the outcome is decided, and toggles the selection in the betslip.
 */
export function OddsButton({ event, market, selection, label, className }: OddsButtonProps) {
  const live = useSelectionLiveState(selection, market.status);
  const selected = useInBetslip(selection.id);
  const locked = !live.active || live.marketStatus !== 'open';
  const direction =
    live.previousOdds === null ? null : live.odds > live.previousOdds ? 'up' : 'down';

  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      aria-label={`${label}: ${locked ? '—' : live.odds.toFixed(2)}`}
      onClick={() =>
        toggleSelection({
          selectionId: selection.id,
          marketId: market.id,
          eventId: event.id,
          sport: event.sport,
          home: event.home,
          away: event.away,
          marketType: market.type,
          line: market.line,
          selectionKey: selection.key,
          odds: live.odds,
        })
      }
      className={cn(
        'relative flex h-11 min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-transparent bg-secondary px-3 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed',
        selected && 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover',
        locked && 'opacity-50 hover:bg-secondary',
        className,
      )}
    >
      <span
        className={cn(
          'truncate text-xs',
          selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {locked ? (
        <Lock className="ml-auto size-3.5 shrink-0" />
      ) : (
        <span className="ml-auto font-bold tabular">{live.odds.toFixed(2)}</span>
      )}
      {direction && !locked && (
        // Re-keyed on every price change so the fade restarts.
        <span
          key={live.version}
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 flex animate-flash items-start justify-end p-0.5',
            direction === 'up' ? 'bg-odds-up/15 text-odds-up' : 'bg-odds-down/15 text-odds-down',
          )}
        >
          {direction === 'up' ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
      )}
    </button>
  );
}
