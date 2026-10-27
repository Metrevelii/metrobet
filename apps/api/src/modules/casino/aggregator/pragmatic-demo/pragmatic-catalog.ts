import type { GameTag } from '@metrobet/contracts';

type PragmaticSlot = [
  symbol: string,
  name: string,
  tags: GameTag[],
  volatility: 'low' | 'medium' | 'high',
  popularity: number,
];

/**
 * Curated Pragmatic Play slots for the dev demo adapter. Symbols and names were checked against
 * Pragmatic's public demo launcher (its redirect returns the official name for each symbol), and
 * every symbol has a square cover on their CDN.
 */
export const PRAGMATIC_SLOTS: PragmaticSlot[] = [
  ['vs20olympgate', 'Gates of Olympus', ['hot'], 'high', 990],
  ['vs20olympx', 'Gates of Olympus 1000', ['new', 'hot'], 'high', 960],
  ['vs20fruitsw', 'Sweet Bonanza', ['hot'], 'medium', 985],
  ['vs20sbxmas', 'Sweet Bonanza Xmas', [], 'medium', 700],
  ['vs10bbbonanza', 'Big Bass Bonanza', ['hot'], 'medium', 950],
  ['vs12bbb', 'Bigger Bass Bonanza', [], 'medium', 820],
  ['vs10txbigbass', 'Big Bass Splash', ['new'], 'high', 900],
  ['vs20doghouse', 'The Dog House', [], 'high', 930],
  ['vs25wolfgold', 'Wolf Gold', ['jackpot'], 'medium', 910],
  ['vs20starlight', 'Starlight Princess', [], 'high', 920],
  ['vs20starlightx', 'Starlight Princess 1000', ['new'], 'high', 880],
  ['vs20sugarrush', 'Sugar Rush', ['hot'], 'high', 940],
  ['vs20sugarrushx', 'Sugar Rush 1000', ['new'], 'high', 870],
  ['vs20fruitparty', 'Fruit Party', [], 'high', 860],
  ['vs243lions', '5 Lions', [], 'high', 640],
  ['vs5aztecgems', 'Aztec Gems', [], 'medium', 620],
  ['vs40wildwest', 'Wild West Gold', [], 'high', 810],
  ['vs25mustang', 'Mustang Gold', ['jackpot'], 'medium', 760],
  ['vs20rhino', 'Great Rhino', [], 'medium', 740],
  ['vs20chicken', 'The Great Chicken Escape', [], 'medium', 600],
  ['vs20rockvegas', 'Rock Vegas', [], 'medium', 580],
  ['vs20emptybank', 'Empty the Bank', [], 'high', 660],
  ['vs20bonzgold', 'Bonanza Gold', [], 'high', 610],
  ['vs25jokerking', 'Joker King', [], 'medium', 570],
  ['vs5joker', "Joker's Jewels", [], 'medium', 720],
  ['vs10bookoftut', 'Book of Tut', [], 'high', 690],
  ['vs20midas', 'The Hand of Midas', [], 'high', 680],
  ['vs25pyramid', 'Pyramid King', [], 'medium', 560],
  ['vs20goldfever', 'Gems Bonanza', [], 'high', 650],
  ['vs20gatotgates', 'Gates of Gatot Kaca', [], 'high', 540],
  ['vs25chilli', 'Chilli Heat', ['jackpot'], 'medium', 630],
  ['vs20hburnhs', 'Hot to Burn Hold and Spin', ['jackpot'], 'medium', 590],
  ['vs10madame', 'Madame Destiny', [], 'high', 550],
  ['vs25pandagold', 'Panda Fortune', ['jackpot'], 'medium', 530],
  ['vs20xmascarol', 'Christmas Carol Megaways', [], 'high', 520],
  ['vs432congocash', 'Congo Cash', [], 'medium', 510],
  ['vs20tweethouse', 'The Tweety House', [], 'high', 500],
  ['vs20mustanggld2', 'Clover Gold', [], 'medium', 490],
  ['vs10fruity2', 'Extra Juicy', [], 'high', 480],
  ['vs20wildpix', 'Wild Pixies', [], 'medium', 470],
];
