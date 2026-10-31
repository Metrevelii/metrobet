import type { MarketType, SelectionKey } from '@metrobet/contracts';

const MARKETS: Record<MarketType, string> = {
  '1x2': 'Match result',
  double_chance: 'Double chance',
  total: 'Total',
  btts: 'Both teams to score',
  moneyline: 'Winner',
  spread: 'Handicap',
  set_winner: 'Set winner',
};

const SELECTIONS: Record<SelectionKey, string> = {
  home: 'Home',
  draw: 'Draw',
  away: 'Away',
  over: 'Over',
  under: 'Under',
  yes: 'Yes',
  no: 'No',
  home_draw: 'Home or draw',
  home_away: 'Home or away',
  draw_away: 'Draw or away',
};

/** English label for a placed selection, e.g. "Total 2.5 · Over" (the backoffice is English only). */
export function selectionText(type: MarketType, line: number | null, key: SelectionKey): string {
  const market =
    type === 'set_winner'
      ? `Set ${line} winner`
      : line === null
        ? MARKETS[type]
        : `${MARKETS[type]} ${line}`;
  return `${market} · ${SELECTIONS[key]}`;
}
