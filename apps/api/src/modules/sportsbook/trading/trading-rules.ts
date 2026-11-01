import {
  BET_LIMITS,
  type EffectiveTrading,
  type EventDetail,
  type Market,
  type Sport,
} from '@metrobet/contracts';
import { Injectable } from '@nestjs/common';

import type { TradingRuleRow, TradingSuspensionRow } from './trading.schema.js';

type Listener = (eventIds: string[] | null) => void;
type Target = { sport: Sport; competition: { id: string } };

const MIN_ODDS = 1.01;
const MAX_ODDS = 100;

/**
 * A market priced again at `margin` percent: the feed's implied probabilities are normalised
 * (its own margin removed), then the new margin is added. Ids and statuses stay the same.
 */
export function remargin(market: Market, margin: number): Market {
  const implied = market.selections.map((selection) => 1 / selection.odds);
  const total = implied.reduce((sum, value) => sum + value, 0);
  if (market.selections.length < 2 || !(total > 0)) return market;
  return {
    ...market,
    selections: market.selections.map((selection, index) => {
      const odds = 1 / ((implied[index]! / total) * (1 + margin / 100));
      return {
        ...selection,
        odds: Math.min(MAX_ODDS, Math.max(MIN_ODDS, Math.round(odds * 100) / 100)),
      };
    }),
  };
}

const suspend = (market: Market): Market =>
  market.status === 'open'
    ? {
        ...market,
        status: 'suspended',
        selections: market.selections.map((selection) => ({ ...selection, active: false })),
      }
    : market;

/**
 * In-memory trading state (suspensions, margin and limit rules) and how it changes what the
 * feed sends. `TradingService` keeps it in sync with the database; `SportsbookStore` applies it
 * to every feed update and re-applies it when it changes. Pure: no I/O.
 */
@Injectable()
export class TradingRules {
  private readonly suspensions = new Map<string, TradingSuspensionRow>();
  /** Suspended target ids per event, so most events skip the lookup. */
  private readonly byEvent = new Map<string, Set<string>>();
  private readonly rules = new Map<string, TradingRuleRow>();
  private readonly listeners = new Set<Listener>();

  /** Called with the events whose prices may change, or null for all of them. */
  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  load(suspensions: TradingSuspensionRow[], rules: TradingRuleRow[]) {
    this.suspensions.clear();
    this.byEvent.clear();
    this.rules.clear();
    for (const row of suspensions) this.addSuspension(row);
    for (const row of rules) this.rules.set(`${row.scope}:${row.key}`, row);
    this.emit(null);
  }

  setSuspension(row: TradingSuspensionRow) {
    this.addSuspension(row);
    this.emit([row.eventId]);
  }

  clearSuspension(targetId: string) {
    const row = this.suspensions.get(targetId);
    if (!row) return;
    this.suspensions.delete(targetId);
    const targets = this.byEvent.get(row.eventId);
    targets?.delete(targetId);
    if (targets?.size === 0) this.byEvent.delete(row.eventId);
    this.emit([row.eventId]);
  }

  suspension(targetId: string): TradingSuspensionRow | undefined {
    return this.suspensions.get(targetId);
  }

  suspensionsOf(eventId: string): TradingSuspensionRow[] {
    return [...(this.byEvent.get(eventId) ?? [])].map((id) => this.suspensions.get(id)!);
  }

  isEventSuspended(eventId: string) {
    return this.suspensions.has(eventId);
  }

  setRule(row: TradingRuleRow) {
    this.rules.set(`${row.scope}:${row.key}`, row);
    this.emit(null);
  }

  deleteRule(scope: TradingRuleRow['scope'], key: string) {
    if (this.rules.delete(`${scope}:${key}`)) this.emit(null);
  }

  allRules(): TradingRuleRow[] {
    return [...this.rules.values()];
  }

  /** Margin and limits for an event: competition rule, then sport rule, then defaults. */
  effective({ sport, competition }: Target): EffectiveTrading {
    const rules = [
      this.rules.get(`competition:${competition.id}`),
      this.rules.get(`sport:${sport}`),
    ];
    const pick = <K extends 'margin' | 'maxStake' | 'maxPayout'>(field: K) =>
      rules.find((rule) => rule?.[field] != null)?.[field] ?? null;
    return {
      margin: pick('margin'),
      maxStake: pick('maxStake') ?? BET_LIMITS.maxStake,
      maxPayout: pick('maxPayout') ?? BET_LIMITS.maxPayout,
    };
  }

  /** Limits of a ticket over these events: the strictest of them. */
  limitsFor(events: Target[]): Pick<EffectiveTrading, 'maxStake' | 'maxPayout'> {
    const all = events.map((event) => this.effective(event));
    if (all.length === 0) return { maxStake: BET_LIMITS.maxStake, maxPayout: BET_LIMITS.maxPayout };
    return {
      maxStake: Math.min(...all.map((item) => item.maxStake)),
      maxPayout: Math.min(...all.map((item) => item.maxPayout)),
    };
  }

  /** The event as players see it: margin rule applied, suspended markets locked. */
  apply(event: EventDetail): EventDetail {
    const { margin } = this.effective(event);
    const suspended = this.byEvent.get(event.id);
    if (margin === null && !suspended) return event;
    const all = this.suspensions.has(event.id);
    return {
      ...event,
      markets: event.markets.map((market) => {
        const priced = margin === null ? market : remargin(market, margin);
        return all || suspended?.has(market.id) ? suspend(priced) : priced;
      }),
    };
  }

  private addSuspension(row: TradingSuspensionRow) {
    this.suspensions.set(row.targetId, row);
    const targets = this.byEvent.get(row.eventId) ?? new Set();
    targets.add(row.targetId);
    this.byEvent.set(row.eventId, targets);
  }

  private emit(eventIds: string[] | null) {
    for (const listener of this.listeners) listener(eventIds);
  }
}
