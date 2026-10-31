/** Flag (emoji) for the competition countries the feed uses; a globe for anything else. */
const FLAGS: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Georgia: '🇬🇪',
  USA: '🇺🇸',
  Europe: '🇪🇺',
};

export const countryFlag = (country: string) => FLAGS[country] ?? '🌍';
