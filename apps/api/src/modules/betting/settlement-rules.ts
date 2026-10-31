import {
  comboOdds,
  type LiveState,
  type MarketType,
  payoutFor,
  type SelectionKey,
  type SelectionResult,
  type TicketStatus,
} from '@metrobet/contracts';

export type SettledSelection = {
  marketType: MarketType;
  line: number | null;
  selectionKey: SelectionKey;
};

const winnerOf = ({ home, away }: { home: number; away: number }) =>
  home > away ? 'home' : home < away ? 'away' : 'draw';

const won = (condition: boolean): SelectionResult => (condition ? 'won' : 'lost');

/** A selection's result from the final score (rules in this module's CLAUDE.md, #6). */
export function selectionResult(
  { marketType, line, selectionKey }: SettledSelection,
  { score, periodScores }: LiveState,
): SelectionResult {
  switch (marketType) {
    case '1x2':
      return won(winnerOf(score) === selectionKey);
    case 'double_chance': {
      const winner = winnerOf(score);
      return won(selectionKey.split('_').includes(winner));
    }
    case 'total': {
      const total = score.home + score.away;
      if (line === null || total === line) return 'void';
      return won(selectionKey === 'over' ? total > line : total < line);
    }
    case 'btts':
      return won((score.home > 0 && score.away > 0) === (selectionKey === 'yes'));
    case 'moneyline': {
      const winner = winnerOf(score);
      return winner === 'draw' ? 'void' : won(winner === selectionKey);
    }
    case 'spread': {
      // The line is a handicap applied to the home side.
      const margin = score.home + (line ?? 0) - score.away;
      if (margin === 0) return 'void';
      return won((margin > 0 ? 'home' : 'away') === selectionKey);
    }
    case 'set_winner': {
      const set = line === null ? undefined : periodScores[line - 1];
      if (!set || set.home === set.away) return 'void';
      return won(winnerOf(set) === selectionKey);
    }
  }
}

export type TicketOutcome =
  { status: 'open' } | { status: Exclude<TicketStatus, 'open'>; odds: number; payout: number };

/**
 * A ticket's outcome from its selections' results (rules in CLAUDE.md, #7): lost as soon as one
 * selection is lost, open while any is unknown, otherwise won at the product of the non-void
 * odds, or void (stake back) when every selection is void.
 */
export function ticketOutcome(
  stake: number,
  selections: readonly { odds: number; result: SelectionResult | null }[],
): TicketOutcome {
  if (selections.some((selection) => selection.result === 'lost')) {
    return { status: 'lost', odds: 0, payout: 0 };
  }
  if (selections.some((selection) => selection.result === null)) return { status: 'open' };
  const winning = selections.filter((selection) => selection.result === 'won');
  if (winning.length === 0) return { status: 'void', odds: 1, payout: stake };
  const odds = comboOdds(winning.map((selection) => selection.odds));
  return { status: 'won', odds, payout: payoutFor(stake, odds) };
}
