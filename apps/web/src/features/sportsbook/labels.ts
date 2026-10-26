import type { Competitor, Market, Selection } from '@metrobet/contracts';
import type { useTranslations } from 'next-intl';

type SportsT = ReturnType<typeof useTranslations<'Sports'>>;

const formatLine = (line: number | null, signed = false) =>
  line === null ? '' : signed && line > 0 ? `+${line}` : String(line);

export function marketLabel(t: SportsT, market: Pick<Market, 'type' | 'line'>): string {
  return t(`markets.${market.type}`, { line: formatLine(market.line, market.type === 'spread') });
}

/**
 * Selection label. `short` gives the compact column label used in lists (1 / X / 2);
 * the long form names the teams where that's clearer (event page, betslip).
 */
export function selectionLabel(
  t: SportsT,
  market: Pick<Market, 'type' | 'line'>,
  selection: Pick<Selection, 'key'>,
  teams: { home: Competitor; away: Competitor },
  short = false,
): string {
  const { key } = selection;
  if (key === 'over' || key === 'under')
    return t(`selections.${key}`, { line: formatLine(market.line) });
  if (short || !['home', 'away', 'draw'].includes(key)) return t(`selections.${key}`, { line: '' });
  if (key === 'draw') return t('selections.drawLong');
  const team = teams[key as 'home' | 'away'].name;
  if (market.type === 'spread' && market.line !== null) {
    return `${team} ${formatLine(key === 'home' ? market.line : -market.line, true)}`;
  }
  return team;
}

/** Localized period name (1st half, Q3, Set 2…); unknown codes are shown as-is. */
export function periodLabel(t: SportsT, period: string): string {
  const key = `periods.${period}` as 'periods.FT';
  return t.has(key) ? t(key) : period;
}
