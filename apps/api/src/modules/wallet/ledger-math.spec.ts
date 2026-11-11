import {
  applyLegs,
  assertBalanced,
  bonusShare,
  InsufficientFundsError,
  type Leg,
  legsFingerprint,
  payoutLegs,
  splitStake,
} from './ledger-math.js';

const PLAYER = '00000000-0000-4000-8000-000000000001';
const player = { kind: 'player', playerId: PLAYER } as const;
const bet = (amount: number): Leg[] => [
  { account: player, amount: -amount },
  { account: { kind: 'house' }, amount },
];

describe('assertBalanced', () => {
  it('accepts legs that sum to zero', () => {
    expect(() => assertBalanced(bet(500), PLAYER)).not.toThrow();
  });

  it.each([
    ['one leg', [{ account: player, amount: 1 }]],
    [
      'a non-zero sum',
      [
        { account: player, amount: 5 },
        { account: { kind: 'house' }, amount: -4 },
      ],
    ],
    [
      'a zero amount',
      [
        { account: player, amount: 0 },
        { account: { kind: 'house' }, amount: 0 },
      ],
    ],
    [
      'a fraction',
      [
        { account: player, amount: 1.5 },
        { account: { kind: 'house' }, amount: -1.5 },
      ],
    ],
    [
      'two legs on one account',
      [
        { account: player, amount: 1 },
        { account: player, amount: -1 },
      ],
    ],
    [
      "another player's money",
      [
        { account: { kind: 'player', playerId: 'someone-else' }, amount: -1 },
        { account: { kind: 'house' }, amount: 1 },
      ],
    ],
  ] as [string, Leg[]][])('rejects %s', (_, legs) => {
    expect(() => assertBalanced(legs, PLAYER)).toThrow();
  });
});

const balances = (playerBalance: number) =>
  new Map([
    [`player:${PLAYER}`, playerBalance],
    ['house', 0],
  ]);

describe('applyLegs', () => {
  it('moves money and lets system accounts go negative', () => {
    const win: Leg[] = [
      { account: { kind: 'house' }, amount: -700 },
      { account: player, amount: 700 },
    ];
    expect(applyLegs(win, balances(100))).toEqual(
      new Map([
        ['house', -700],
        [`player:${PLAYER}`, 800],
      ]),
    );
  });

  it('allows spending the whole balance but never more', () => {
    expect(applyLegs(bet(100), balances(100)).get(`player:${PLAYER}`)).toBe(0);
    expect(() => applyLegs(bet(101), balances(100))).toThrow(InsufficientFundsError);
  });
});

describe('legsFingerprint', () => {
  it('ignores leg order but not amounts', () => {
    expect(legsFingerprint(bet(5))).toBe(legsFingerprint(bet(5).toReversed()));
    expect(legsFingerprint(bet(5))).not.toBe(legsFingerprint(bet(6)));
  });
});

describe('bonus money', () => {
  it('pays stakes from cash first, then bonus money', () => {
    expect(splitStake(80, 50, 100)).toEqual({ fromCash: 50, fromBonus: 30 });
    expect(splitStake(30, 50, 100)).toEqual({ fromCash: 30, fromBonus: 0 });
    expect(splitStake(100, 0, 100)).toEqual({ fromCash: 0, fromBonus: 100 });
    expect(() => splitStake(151, 50, 100)).toThrow(InsufficientFundsError);
  });

  it('returns the bonus share of a payout, rounded down', () => {
    expect(bonusShare(40, 80, 30)).toBe(15);
    expect(bonusShare(10, 3, 1)).toBe(3);
    expect(bonusShare(50, 50, 0)).toBe(0);
    expect(bonusShare(50, 0, 0)).toBe(0);
  });

  it('builds balanced payout legs, leaving out empty ones', () => {
    const legs = payoutLegs(PLAYER, 40, 15);
    expect(legs).toEqual([
      { account: { kind: 'house' }, amount: -40 },
      { account: player, amount: 25 },
      { account: { kind: 'bonus', playerId: PLAYER }, amount: 15 },
    ]);
    expect(() => assertBalanced(legs, PLAYER)).not.toThrow();
    expect(payoutLegs(PLAYER, 20)).toHaveLength(2);
    expect(payoutLegs(PLAYER, 20, 20)).toHaveLength(2);
  });

  it("keeps a player's bonus account from going negative", () => {
    const bonus = { kind: 'bonus', playerId: PLAYER } as const;
    expect(() =>
      applyLegs(
        [
          { account: bonus, amount: -11 },
          { account: { kind: 'house' }, amount: 11 },
        ],
        new Map([
          ['bonus:' + PLAYER, 10],
          ['house', 0],
        ]),
      ),
    ).toThrow(InsufficientFundsError);
  });
});
