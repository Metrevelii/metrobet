import type { GameTag, GameType } from '@metrobet/contracts';

/** Fictional studios and games for the mock aggregator. Any resemblance to real brands is unintended. */
export type MockProvider = {
  id: string;
  name: string;
  /** Two gradient colours used by the generated thumbnails. */
  palette: [string, string];
  type: GameType;
  games: string[];
};

export const MOCK_PROVIDERS: MockProvider[] = [
  {
    id: 'golden-fleece',
    name: 'Golden Fleece Studios',
    palette: ['#f5b335', '#7a2e0e'],
    type: 'slot',
    games: [
      "Argonauts' Gold",
      'Colchis Treasure',
      "Medea's Spell",
      'Fleece of Fortune',
      "Jason's Voyage",
      'Dragon of Colchis',
      'Phasis River',
      'Golden Ram',
    ],
  },
  {
    id: 'neon-forge',
    name: 'Neon Forge',
    palette: ['#ff3dc8', '#3b1d8f'],
    type: 'slot',
    games: [
      'Cyber Sevens',
      'Neon Nights',
      'Synthwave Spins',
      'Laser Fruits',
      'Grid Runner',
      'Pixel Gems',
      'Volt Reels',
      'Chrome Cherries',
    ],
  },
  {
    id: 'tbilisi-spin',
    name: 'Tbilisi Spin',
    palette: ['#e5293c', '#2a0f3d'],
    type: 'slot',
    games: [
      'Old Town Riches',
      'Supra Feast',
      'Narikala Nights',
      'Sulfur Baths',
      'Khachapuri King',
      'Rustaveli Royale',
      'Mtatsminda Wheel',
      "Tamada's Toast",
    ],
  },
  {
    id: 'aurora-play',
    name: 'Aurora Play',
    palette: ['#22d3ee', '#1e3a8a'],
    type: 'slot',
    games: [
      'Northern Lights',
      'Ice Queen',
      'Polar Fortune',
      'Frozen Gems',
      'Midnight Sun',
      'Snow Wolf',
      'Glacier Gold',
      'Aurora Crown',
    ],
  },
  {
    id: 'red-rocket',
    name: 'Red Rocket',
    palette: ['#ff7a1a', '#7f1020'],
    type: 'crash',
    games: ['Sky Rush', 'Jet Lift', 'Rocket Run', 'Moon Shot', 'Turbo Climb', 'Comet Cash'],
  },
  {
    id: 'lucky-lynx',
    name: 'Lucky Lynx',
    palette: ['#2ee59d', '#0f3d2e'],
    type: 'slot',
    games: [
      'Lynx Fortune',
      'Wild Forest',
      'Lucky Paws',
      'Amber Woods',
      'Fox & Coins',
      'Moonlit Lynx',
      'Berry Bonanza',
      "Hunter's Gold",
    ],
  },
  {
    id: 'pixel-pharaoh',
    name: 'Pixel Pharaoh',
    palette: ['#ffd166', '#1f4e79'],
    type: 'slot',
    games: [
      'Book of Sands',
      'Nile Treasures',
      'Scarab Spins',
      'Pyramid Gold',
      "Cleo's Jewels",
      'Anubis Rising',
      'Desert Oasis',
      'Sphinx Secrets',
    ],
  },
  {
    id: 'stormline',
    name: 'Stormline',
    palette: ['#a78bfa', '#111a3d'],
    type: 'slot',
    games: [
      'Thunder Reels',
      'Storm Chaser',
      'Zeus Strike',
      'Lightning Gems',
      'Tempest Gold',
      'Hurricane Hits',
      'Rain of Coins',
      'Cloud Kingdom',
    ],
  },
  {
    id: 'velvet-tables',
    name: 'Velvet Tables',
    palette: ['#10b981', '#3f0d12'],
    type: 'table',
    games: [
      'European Roulette',
      'Blackjack Classic',
      'Baccarat Gold',
      "Casino Hold'em",
      'French Roulette',
      'Blackjack VIP',
      'Three Card Poker',
      'Dragon Tiger',
    ],
  },
  {
    id: 'fruit-factory',
    name: 'Fruit Factory',
    palette: ['#c6ff3d', '#5b1a6b'],
    type: 'slot',
    games: [
      'Fruit Blast',
      'Sizzling Sevens',
      'Cherry Burst',
      'Melon Mania',
      'Lemon Twist',
      'Berry Wild',
      'Classic 777',
      'Juicy Jackpot',
    ],
  },
];

/** Small deterministic hash so the mock catalogue is identical on every sync. */
export function hash(value: string): number {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function mockTags(name: string): GameTag[] {
  const h = hash(name);
  const tags: GameTag[] = [];
  if (h % 7 === 0) tags.push('new');
  if (h % 5 === 0) tags.push('hot');
  if (/gold|fortune|jackpot|treasure|riches|crown/i.test(name) || h % 11 === 0)
    tags.push('jackpot');
  return tags;
}
