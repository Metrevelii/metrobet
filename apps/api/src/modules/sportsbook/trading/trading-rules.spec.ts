import { BET_LIMITS, type EventDetail, type Market } from '@metrobet/contracts';

import { SportsbookStore } from '../sportsbook.store.js';
import { remargin, TradingRules } from './trading-rules.js';
import type { TradingRuleRow, TradingSuspensionRow } from './trading.schema.js';

const market = (id: string, odds: number[]): Market => ({
  id,
  type: 'total',
  line: 2.5,
  status: 'open',
  selections: odds.map((value, index) => ({
    id: `${id}:${index === 0 ? 'over' : 'under'}`,
    key: index === 0 ? 'over' : 'under',
    odds: value,
    active: true,
  })),
});

const event = (id = 'e1'): EventDetail => ({
  id,
  sport: 'football',
  competition: { id: 'epl', name: 'Premier League', country: 'England', sport: 'football' },
  home: { name: 'A', abbreviation: 'A' },
  away: { name: 'B', abbreviation: 'B' },
  startsAt: new Date(0).toISOString(),
  status: 'scheduled',
  live: null,
  markets: [market(`${id}:total:2.5`, [1.9, 1.9]), market(`${id}:total:3.5`, [3, 1.35])],
});

const suspension = (
  targetId: string,
  scope: 'event' | 'market' = 'market',
): TradingSuspensionRow => ({
  targetId,
  scope,
  eventId: 'e1',
  reason: 'test',
  createdBy: 'staff:x',
  createdAt: new Date(),
});

const rule = (scope: 'sport' | 'competition', key: string, fields: Partial<TradingRuleRow>) =>
  ({
    scope,
    key,
    margin: null,
    maxStake: null,
    maxPayout: null,
    updatedBy: 'staff:x',
    updatedAt: new Date(),
    ...fields,
  }) as TradingRuleRow;

const overround = (m: Market) => m.selections.reduce((sum, s) => sum + 1 / s.odds, 0);

describe('trading rules', () => {
  it('re-prices a market at a new margin, keeping the relative chances', () => {
    const priced = remargin(market('m', [1.9, 1.9]), 10);
    expect(priced.selections.map((s) => s.odds)).toEqual([1.82, 1.82]);
    const skewed = remargin(market('m', [3, 1.35]), 2);
    expect(overround(skewed)).toBeCloseTo(1.02, 2);
    expect(skewed.selections[0]!.odds).toBeGreaterThan(3);
  });

  it('leaves events alone without rules', () => {
    const original = event();
    expect(new TradingRules().apply(original)).toBe(original);
  });

  it('locks a suspended market, or every market of a suspended event', () => {
    const rules = new TradingRules();
    rules.load([suspension('e1:total:2.5')], []);
    const [first, second] = rules.apply(event()).markets;
    expect(first!.status).toBe('suspended');
    expect(first!.selections.every((s) => !s.active)).toBe(true);
    expect(second!.status).toBe('open');

    rules.setSuspension(suspension('e1', 'event'));
    expect(rules.apply(event()).markets.every((m) => m.status === 'suspended')).toBe(true);
    rules.clearSuspension('e1');
    rules.clearSuspension('e1:total:2.5');
    expect(rules.apply(event()).markets.every((m) => m.status === 'open')).toBe(true);
  });

  it('takes the competition rule over the sport rule, field by field, then the defaults', () => {
    const rules = new TradingRules();
    rules.load(
      [],
      [
        rule('sport', 'football', { margin: 8, maxStake: 500_00 }),
        rule('competition', 'epl', { margin: 4 }),
      ],
    );
    expect(rules.effective(event())).toEqual({
      margin: 4,
      maxStake: 500_00,
      maxPayout: BET_LIMITS.maxPayout,
    });
    expect(
      rules.limitsFor([event(), { sport: 'tennis', competition: { id: 'atp' } }]).maxStake,
    ).toBe(500_00);
  });

  it('makes the store re-apply changes at once and emit them', () => {
    const rules = new TradingRules();
    const store = new SportsbookStore(rules);
    store.upsert(event());
    const updates: string[] = [];
    store.on('update', (update) => updates.push(...update.markets.map((m) => m.status)));

    rules.setSuspension(suspension('e1', 'event'));
    expect(updates).toEqual(['suspended', 'suspended']);
    expect(store.findSelection('e1:total:2.5:over')?.selection.active).toBe(false);
    expect(store.feedEvent('e1')?.markets[0]!.status).toBe('open');
  });
});
