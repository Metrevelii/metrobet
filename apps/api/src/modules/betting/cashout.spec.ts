import { CASHOUT_MARGIN, cashoutValue } from '@metrobet/contracts';

/** A 10 ₾ single placed at 3.00, priced at `currentOdds` now. */
const at = (currentOdds: number) =>
  cashoutValue(10_00, 30_00, [{ odds: 3, result: null, currentOdds }]);

describe('cashoutValue', () => {
  it('offers the stake minus the margin when the price has not moved', () => {
    expect(cashoutValue(10_00, 20_00, [{ odds: 2, result: null, currentOdds: 2 }])).toBe(
      Math.floor(10_00 * (1 - CASHOUT_MARGIN)),
    );
  });

  it('grows when the selection becomes more likely and shrinks when it gets less likely', () => {
    expect(at(1.5)).toBe(Math.floor((10_00 * 3 * 0.95) / 1.5)); // 19.00 ₾
    expect(at(6)).toBe(Math.floor((10_00 * 3 * 0.95) / 6)); // 4.75 ₾
  });

  it('counts won legs at their placed odds and drops void legs', () => {
    const value = cashoutValue(5_00, 100_00, [
      { odds: 2, result: 'won', currentOdds: null },
      { odds: 4, result: 'void', currentOdds: null },
      { odds: 1.8, result: null, currentOdds: 1.2 },
    ]);
    expect(value).toBe(Math.floor((5_00 * 2 * 1.8 * 0.95) / 1.2));
  });

  it('is not offered after a lost leg, while a leg is suspended, or once nothing is running', () => {
    expect(
      cashoutValue(5_00, 50_00, [
        { odds: 2, result: 'lost', currentOdds: null },
        { odds: 2, result: null, currentOdds: 2 },
      ]),
    ).toBeNull();
    expect(cashoutValue(5_00, 50_00, [{ odds: 2, result: null, currentOdds: null }])).toBeNull();
    expect(cashoutValue(5_00, 50_00, [{ odds: 2, result: 'won', currentOdds: null }])).toBeNull();
  });

  it('never exceeds the potential win and is not offered below the minimum stake', () => {
    expect(cashoutValue(10_00, 15_00, [{ odds: 3, result: null, currentOdds: 1.01 }])).toBe(15_00);
    expect(cashoutValue(10, 1_00, [{ odds: 2, result: null, currentOdds: 50 }])).toBeNull();
  });
});
