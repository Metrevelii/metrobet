import {
  applyLegs,
  assertBalanced,
  InsufficientFundsError,
  type Leg,
  legsFingerprint,
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
