import { correctScoreOf, type MarketType, type SelectionKey } from '@metrobet/contracts';

const MARKETS: Record<MarketType, string> = {
  '1x2': 'Match result',
  double_chance: 'Double chance',
  total: 'Total',
  btts: 'Both teams to score',
  moneyline: 'Winner',
  spread: 'Handicap',
  set_winner: 'Set winner',
  ht_1x2: 'Half-time result',
  correct_score: 'Correct score',
  team_total_home: 'Home team total',
  team_total_away: 'Away team total',
};

const SELECTIONS: Partial<Record<SelectionKey, string>> = {
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
  cs_other: 'Any other score',
};

/** English market label, e.g. "Total 2.5" or "Set 2 winner". */
export function marketText(type: MarketType, line: number | null): string {
  if (type === 'set_winner') return `Set ${line} winner`;
  if (line === null) return MARKETS[type];
  return `${MARKETS[type]} ${type === 'spread' && line > 0 ? `+${line}` : line}`;
}

/** English selection label, e.g. "Over" or "2:1". */
export const selectionName = (key: SelectionKey) => {
  const score = correctScoreOf(key);
  return score ? `${score.home}:${score.away}` : (SELECTIONS[key] ?? key);
};

/** English label for a placed selection, e.g. "Total 2.5 · Over" (the backoffice is English only). */
export function selectionText(type: MarketType, line: number | null, key: SelectionKey): string {
  return `${marketText(type, line)} · ${selectionName(key)}`;
}
