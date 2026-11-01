import type { LiveState } from '@metrobet/contracts';

import { selectionResult, ticketOutcome } from './settlement-rules.js';

const final = (home: number, away: number, periodScores: LiveState['periodScores'] = []) => ({
  period: 'FT',
  clock: null,
  score: { home, away },
  periodScores,
});

describe('selectionResult', () => {
  it('settles football markets from the final score', () => {
    const twoOne = final(2, 1);
    expect(selectionResult({ marketType: '1x2', line: null, selectionKey: 'home' }, twoOne)).toBe(
      'won',
    );
    expect(selectionResult({ marketType: '1x2', line: null, selectionKey: 'draw' }, twoOne)).toBe(
      'lost',
    );
    expect(
      selectionResult(
        { marketType: 'double_chance', line: null, selectionKey: 'home_draw' },
        twoOne,
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'double_chance', line: null, selectionKey: 'draw_away' },
        twoOne,
      ),
    ).toBe('lost');
    expect(
      selectionResult(
        { marketType: 'double_chance', line: null, selectionKey: 'draw_away' },
        final(1, 1),
      ),
    ).toBe('won');
    expect(selectionResult({ marketType: 'total', line: 2.5, selectionKey: 'over' }, twoOne)).toBe(
      'won',
    );
    expect(selectionResult({ marketType: 'total', line: 3.5, selectionKey: 'under' }, twoOne)).toBe(
      'won',
    );
    expect(selectionResult({ marketType: 'total', line: 3, selectionKey: 'over' }, twoOne)).toBe(
      'void',
    );
    expect(selectionResult({ marketType: 'btts', line: null, selectionKey: 'yes' }, twoOne)).toBe(
      'won',
    );
    expect(
      selectionResult({ marketType: 'btts', line: null, selectionKey: 'no' }, final(3, 0)),
    ).toBe('won');
  });

  it('settles winner and handicap markets, voiding ties and pushes', () => {
    expect(
      selectionResult(
        { marketType: 'moneyline', line: null, selectionKey: 'away' },
        final(98, 101),
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'moneyline', line: null, selectionKey: 'home' },
        final(100, 100),
      ),
    ).toBe('void');
    // Home −5.5: wins by 6+.
    expect(
      selectionResult({ marketType: 'spread', line: -5.5, selectionKey: 'home' }, final(110, 104)),
    ).toBe('won');
    expect(
      selectionResult({ marketType: 'spread', line: -5.5, selectionKey: 'home' }, final(110, 105)),
    ).toBe('lost');
    expect(
      selectionResult({ marketType: 'spread', line: -5, selectionKey: 'away' }, final(110, 105)),
    ).toBe('void');
  });

  it('settles a set winner from that set, voiding sets never played', () => {
    const sets = final(2, 0, [
      { home: 6, away: 4 },
      { home: 7, away: 5 },
    ]);
    expect(selectionResult({ marketType: 'set_winner', line: 2, selectionKey: 'home' }, sets)).toBe(
      'won',
    );
    expect(selectionResult({ marketType: 'set_winner', line: 1, selectionKey: 'away' }, sets)).toBe(
      'lost',
    );
    expect(selectionResult({ marketType: 'set_winner', line: 3, selectionKey: 'home' }, sets)).toBe(
      'void',
    );
  });
});

/** Full time from two halves, with the halves as period scores. */
const halves = (h1: [number, number], h2: [number, number]) => ({
  ...final(h1[0] + h2[0], h1[1] + h2[1]),
  periodScores: [
    { home: h1[0], away: h1[1] },
    { home: h2[0], away: h2[1] },
  ],
});

describe('selectionResult: newer football markets', () => {
  it('settles the half-time result from the first half', () => {
    const match = halves([0, 1], [3, 0]); // 3–1 full time, 0–1 at half-time
    expect(selectionResult({ marketType: 'ht_1x2', line: null, selectionKey: 'away' }, match)).toBe(
      'won',
    );
    expect(selectionResult({ marketType: '1x2', line: null, selectionKey: 'home' }, match)).toBe(
      'won',
    );
    expect(
      selectionResult({ marketType: 'ht_1x2', line: null, selectionKey: 'home' }, final(1, 0)),
    ).toBe('void');
  });

  it('settles the correct score, with "other" outside 0–0 … 3–3', () => {
    expect(
      selectionResult(
        { marketType: 'correct_score', line: null, selectionKey: 'cs_2_1' },
        final(2, 1),
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'correct_score', line: null, selectionKey: 'cs_1_2' },
        final(2, 1),
      ),
    ).toBe('lost');
    expect(
      selectionResult(
        { marketType: 'correct_score', line: null, selectionKey: 'cs_other' },
        final(4, 1),
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'correct_score', line: null, selectionKey: 'cs_other' },
        final(3, 3),
      ),
    ).toBe('lost');
  });

  it('settles team totals on that team only', () => {
    expect(
      selectionResult(
        { marketType: 'team_total_home', line: 1.5, selectionKey: 'over' },
        final(2, 0),
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'team_total_away', line: 0.5, selectionKey: 'under' },
        final(2, 0),
      ),
    ).toBe('won');
    expect(
      selectionResult(
        { marketType: 'team_total_away', line: 0.5, selectionKey: 'over' },
        final(2, 0),
      ),
    ).toBe('lost');
  });
});

describe('ticketOutcome', () => {
  it('loses as soon as one selection loses, even with others open', () => {
    expect(
      ticketOutcome(10_00, [
        { odds: 2, result: 'lost' },
        { odds: 3, result: null },
      ]),
    ).toEqual({ status: 'lost', odds: 0, payout: 0 });
  });

  it('stays open while a selection is unknown', () => {
    expect(
      ticketOutcome(10_00, [
        { odds: 2, result: 'won' },
        { odds: 3, result: null },
      ]),
    ).toEqual({
      status: 'open',
    });
  });

  it('pays the product of the winning odds, counting void selections as 1.00', () => {
    expect(
      ticketOutcome(10_00, [
        { odds: 1.85, result: 'won' },
        { odds: 2.1, result: 'void' },
        { odds: 1.5, result: 'won' },
      ]),
    ).toEqual({ status: 'won', odds: 2.77, payout: 27_70 });
  });

  it('refunds the stake when every selection is void', () => {
    expect(ticketOutcome(7_50, [{ odds: 2, result: 'void' }])).toEqual({
      status: 'void',
      odds: 1,
      payout: 7_50,
    });
  });
});
