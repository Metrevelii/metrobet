import type { Competition, Sport } from '@metrobet/contracts';

/** [name, abbreviation, strength 50–95]. Names are public fixture data; no logos are used. */
export type Team = readonly [name: string, abbreviation: string, rating: number];

/**
 * A competition plays a "round" every `cadenceSlots` (15-min slots), with `matchesPerRound`
 * matches between distinct teams. The cadence is longer than a match, so no team ever plays
 * two matches at once.
 */
export type SimCompetition = Competition & {
  teams: readonly Team[];
  cadenceSlots: number;
  matchesPerRound: number;
};

/** Round cadence per sport, in slots: longer than the longest possible match. */
export const CADENCE: Record<Sport, number> = { football: 8, basketball: 6, tennis: 14 };

const football = (id: string, name: string, country: string, teams: Team[]): SimCompetition => ({
  id,
  name,
  country,
  sport: 'football',
  cadenceSlots: CADENCE.football,
  matchesPerRound: 2,
  teams,
});

export const COMPETITIONS: SimCompetition[] = [
  football('eng-premier-league', 'Premier League', 'England', [
    ['Arsenal', 'ARS', 89],
    ['Manchester City', 'MCI', 90],
    ['Liverpool', 'LIV', 90],
    ['Chelsea', 'CHE', 84],
    ['Manchester United', 'MUN', 80],
    ['Tottenham', 'TOT', 81],
    ['Newcastle', 'NEW', 82],
    ['Aston Villa', 'AVL', 81],
    ['Brighton', 'BHA', 77],
    ['West Ham', 'WHU', 74],
  ]),
  football('esp-laliga', 'LaLiga', 'Spain', [
    ['Real Madrid', 'RMA', 91],
    ['Barcelona', 'BAR', 90],
    ['Atlético Madrid', 'ATM', 85],
    ['Athletic Club', 'ATH', 80],
    ['Real Sociedad', 'RSO', 78],
    ['Villarreal', 'VIL', 79],
    ['Real Betis', 'BET', 77],
    ['Sevilla', 'SEV', 74],
    ['Valencia', 'VAL', 72],
    ['Girona', 'GIR', 76],
  ]),
  football('ita-serie-a', 'Serie A', 'Italy', [
    ['Inter', 'INT', 88],
    ['Milan', 'MIL', 83],
    ['Juventus', 'JUV', 84],
    ['Napoli', 'NAP', 85],
    ['Roma', 'ROM', 80],
    ['Lazio', 'LAZ', 78],
    ['Atalanta', 'ATA', 83],
    ['Fiorentina', 'FIO', 77],
    ['Bologna', 'BOL', 77],
    ['Torino', 'TOR', 72],
  ]),
  football('ger-bundesliga', 'Bundesliga', 'Germany', [
    ['Bayern Munich', 'BAY', 90],
    ['Borussia Dortmund', 'BVB', 83],
    ['Bayer Leverkusen', 'B04', 86],
    ['RB Leipzig', 'RBL', 82],
    ['Eintracht Frankfurt', 'SGE', 78],
    ['Stuttgart', 'VFB', 79],
    ['Wolfsburg', 'WOB', 73],
    ['Freiburg', 'SCF', 75],
    ['Union Berlin', 'FCU', 72],
    ['Werder Bremen', 'SVW', 72],
  ]),
  football('uefa-champions-league', 'Champions League', 'Europe', [
    ['Real Madrid', 'RMA', 91],
    ['Manchester City', 'MCI', 90],
    ['Bayern Munich', 'BAY', 90],
    ['Barcelona', 'BAR', 90],
    ['Liverpool', 'LIV', 90],
    ['Inter', 'INT', 88],
    ['Paris Saint-Germain', 'PSG', 88],
    ['Arsenal', 'ARS', 89],
    ['Benfica', 'BEN', 80],
    ['Porto', 'POR', 79],
  ]),
  football('geo-erovnuli-liga', 'Erovnuli Liga', 'Georgia', [
    ['Dinamo Tbilisi', 'DIN', 72],
    ['Dinamo Batumi', 'DBA', 71],
    ['Torpedo Kutaisi', 'TOR', 68],
    ['Iberia 1999', 'IBE', 70],
    ['Dila Gori', 'DIL', 66],
    ['Telavi', 'TEL', 63],
    ['Samgurali', 'SAM', 64],
    ['Kolkheti Poti', 'KOL', 61],
    ['Gagra', 'GAG', 63],
    ['Spaeri', 'SPA', 60],
  ]),
  {
    id: 'nba',
    name: 'NBA',
    country: 'USA',
    sport: 'basketball',
    cadenceSlots: CADENCE.basketball,
    matchesPerRound: 2,
    teams: [
      ['Boston Celtics', 'BOS', 90],
      ['Denver Nuggets', 'DEN', 87],
      ['Oklahoma City Thunder', 'OKC', 89],
      ['Milwaukee Bucks', 'MIL', 84],
      ['Los Angeles Lakers', 'LAL', 82],
      ['Golden State Warriors', 'GSW', 81],
      ['New York Knicks', 'NYK', 85],
      ['Miami Heat', 'MIA', 79],
      ['Phoenix Suns', 'PHX', 79],
      ['Dallas Mavericks', 'DAL', 84],
    ],
  },
  {
    id: 'euroleague',
    name: 'EuroLeague',
    country: 'Europe',
    sport: 'basketball',
    cadenceSlots: CADENCE.basketball,
    matchesPerRound: 2,
    teams: [
      ['Real Madrid', 'RMB', 86],
      ['Barcelona', 'FCB', 83],
      ['Fenerbahçe', 'FEN', 85],
      ['Olympiacos', 'OLY', 84],
      ['Panathinaikos', 'PAO', 85],
      ['Anadolu Efes', 'EFS', 80],
      ['Maccabi Tel Aviv', 'MTA', 78],
      ['Partizan', 'PAR', 79],
      ['Monaco', 'MON', 82],
      ['Bayern Munich', 'FCBB', 77],
    ],
  },
  {
    id: 'atp',
    name: 'ATP Tour',
    country: 'World',
    sport: 'tennis',
    cadenceSlots: CADENCE.tennis,
    matchesPerRound: 2,
    teams: [
      ['Jannik Sinner', 'SIN', 94],
      ['Carlos Alcaraz', 'ALC', 93],
      ['Novak Djokovic', 'DJO', 90],
      ['Alexander Zverev', 'ZVE', 87],
      ['Daniil Medvedev', 'MED', 84],
      ['Taylor Fritz', 'FRI', 84],
      ['Casper Ruud', 'RUU', 81],
      ['Holger Rune', 'RUN', 80],
      ['Alex de Minaur', 'DEM', 82],
      ['Stefanos Tsitsipas', 'TSI', 80],
      ['Jack Draper', 'DRA', 83],
      ['Ben Shelton', 'SHE', 82],
    ],
  },
  {
    id: 'wta',
    name: 'WTA Tour',
    country: 'World',
    sport: 'tennis',
    cadenceSlots: CADENCE.tennis,
    matchesPerRound: 2,
    teams: [
      ['Aryna Sabalenka', 'SAB', 93],
      ['Iga Swiatek', 'SWI', 92],
      ['Coco Gauff', 'GAU', 89],
      ['Elena Rybakina', 'RYB', 88],
      ['Jessica Pegula', 'PEG', 86],
      ['Jasmine Paolini', 'PAO', 84],
      ['Qinwen Zheng', 'ZHE', 85],
      ['Emma Navarro', 'NAV', 82],
      ['Mirra Andreeva', 'AND', 86],
      ['Madison Keys', 'KEY', 85],
    ],
  },
];
