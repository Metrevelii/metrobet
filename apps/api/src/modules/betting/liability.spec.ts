import { liabilityOf, type OpenLeg } from './liability.js';

const leg = (
  ticketId: string,
  selectionId: string,
  stake: number,
  potentialWin: number,
  mode: OpenLeg['mode'] = 'single',
  eventId = 'e1',
): OpenLeg => ({ ticketId, mode, stake, potentialWin, eventId, selectionId });

describe('liability', () => {
  it('nets singles per market and counts combos at their full potential win', () => {
    const result = liabilityOf('e1', [
      leg('t1', 'e1:1x2:-:home', 10_00, 20_00),
      leg('t2', 'e1:1x2:-:away', 30_00, 120_00),
      leg('t3', 'e1:1x2:-:home', 5_00, 50_00, 'combo'),
      leg('t3', 'e2:1x2:-:home', 5_00, 50_00, 'combo', 'e2'),
    ]);
    expect(result.tickets).toBe(3);
    expect(result.stake).toBe(45_00);
    const [market] = result.markets;
    expect(market!.stake).toBe(40_00);
    const net = Object.fromEntries(market!.selections.map((s) => [s.selectionId, s.net]));
    // Home wins: keep 40 in singles stakes, pay 20 (single) + 50 (combo, worst case).
    expect(net['e1:1x2:-:home']).toBe(40_00 - 20_00 - 50_00);
    expect(net['e1:1x2:-:away']).toBe(40_00 - 120_00);
    expect(result.worstCase).toBe(80_00);
  });

  it('is empty without open tickets', () => {
    expect(liabilityOf('e9', [])).toEqual({
      eventId: 'e9',
      tickets: 0,
      stake: 0,
      worstCase: 0,
      markets: [],
    });
  });
});
