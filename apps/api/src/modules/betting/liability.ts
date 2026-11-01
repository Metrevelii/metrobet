import type { EventLiability, MarketLiability, SelectionLiability } from '@metrobet/contracts';

/** An unresolved selection of an open ticket. */
export type OpenLeg = {
  ticketId: string;
  mode: 'single' | 'combo';
  stake: number;
  potentialWin: number;
  eventId: string;
  selectionId: string;
};

/** Selection id `<marketId>:<key>` → market id. */
const marketIdOf = (selectionId: string) => selectionId.slice(0, selectionId.lastIndexOf(':'));

/**
 * What the open tickets risk on one event (rules in contracts `selectionLiabilitySchema`). A
 * combo has at most one selection per event, so nothing is counted twice within an event.
 */
export function liabilityOf(eventId: string, legs: OpenLeg[]): EventLiability {
  const own = legs.filter((leg) => leg.eventId === eventId);
  const stakes = new Map(own.map((leg) => [leg.ticketId, leg.stake]));
  const markets = new Map<string, { stake: number; selections: Map<string, SelectionLiability> }>();

  for (const leg of own) {
    const marketId = marketIdOf(leg.selectionId);
    const market = markets.get(marketId) ?? { stake: 0, selections: new Map() };
    const selection = market.selections.get(leg.selectionId) ?? {
      selectionId: leg.selectionId,
      singles: { count: 0, stake: 0, payout: 0 },
      combos: { count: 0, payout: 0 },
      net: 0,
    };
    if (leg.mode === 'single') {
      market.stake += leg.stake;
      selection.singles.count += 1;
      selection.singles.stake += leg.stake;
      selection.singles.payout += leg.potentialWin;
    } else {
      selection.combos.count += 1;
      selection.combos.payout += leg.potentialWin;
    }
    market.selections.set(leg.selectionId, selection);
    markets.set(marketId, market);
  }

  const result: MarketLiability[] = [...markets].map(([marketId, market]) => ({
    marketId,
    stake: market.stake,
    selections: [...market.selections.values()].map((selection) => ({
      ...selection,
      net: market.stake - selection.singles.payout - selection.combos.payout,
    })),
  }));
  return {
    eventId,
    tickets: stakes.size,
    stake: [...stakes.values()].reduce((sum, stake) => sum + stake, 0),
    worstCase: result.reduce(
      (sum, market) => sum + Math.max(0, ...market.selections.map((selection) => -selection.net)),
      0,
    ),
    markets: result,
  };
}
