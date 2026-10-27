import type { GameType } from '@metrobet/contracts';

import { hash, type MockProvider } from './mock-catalog.js';

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

/** Splits a title into at most 3 lines of ~12 characters for the tile art. */
function wrap(title: string, width = 12): string[] {
  const lines: string[] = [];
  for (const word of title.split(' ')) {
    const last = lines.at(-1);
    if (last && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 3);
}

const SLOT_MOTIFS = [
  // seven
  '<text x="150" y="215" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="150" fill="url(#accent)">7</text>',
  // diamond
  '<path d="M150 90 L215 150 L150 250 L85 150 Z" fill="url(#accent)"/><path d="M85 150 H215 M150 90 L125 150 L150 250 L175 150 Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>',
  // crown
  '<path d="M80 210 L95 120 L130 160 L150 100 L170 160 L205 120 L220 210 Z" fill="url(#accent)"/><rect x="80" y="210" width="140" height="18" rx="6" fill="url(#accent)"/>',
  // coin stack
  '<ellipse cx="150" cy="200" rx="62" ry="20" fill="url(#accent)"/><ellipse cx="150" cy="180" rx="62" ry="20" fill="url(#accent)"/><ellipse cx="150" cy="160" rx="62" ry="20" fill="url(#accent)"/><ellipse cx="150" cy="140" rx="62" ry="20" fill="url(#accent)" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>',
  // star
  '<path d="M150 85 L170 140 L228 142 L182 177 L198 233 L150 200 L102 233 L118 177 L72 142 L130 140 Z" fill="url(#accent)"/>',
  // cherries
  '<path d="M150 95 C140 130 120 150 115 175 M150 95 C165 130 180 150 190 175" stroke="#2ee59d" stroke-width="6" fill="none"/><circle cx="112" cy="190" r="30" fill="url(#accent)"/><circle cx="192" cy="190" r="30" fill="url(#accent)"/>',
];

const TYPE_MOTIFS: Record<Exclude<GameType, 'slot'>, string> = {
  crash:
    '<path d="M60 240 Q160 230 230 110" stroke="url(#accent)" stroke-width="10" fill="none" stroke-linecap="round"/><g transform="translate(230 105) rotate(-40)"><path d="M-30 0 L22 -12 Q40 -6 44 0 Q40 6 22 12 Z" fill="#fff"/><path d="M-6 -10 L-20 -34 L0 -34 L14 -10 Z M-6 10 L-20 34 L0 34 L14 10 Z" fill="url(#accent)"/></g>',
  table:
    '<circle cx="150" cy="165" r="78" fill="none" stroke="url(#accent)" stroke-width="14" stroke-dasharray="20 12"/><circle cx="150" cy="165" r="46" fill="url(#accent)"/><circle cx="150" cy="165" r="18" fill="#0b0e14" opacity=".5"/>',
};

/** Deterministic 300×300 square tile art for a mock game: gradient, motif, title. */
export function renderMockThumbnail(provider: MockProvider, title: string): string {
  const h = hash(title);
  const [from, to] = provider.palette;
  const motif =
    provider.type === 'slot' ? SLOT_MOTIFS[h % SLOT_MOTIFS.length]! : TYPE_MOTIFS[provider.type];
  const angle = h % 360;
  const lines = wrap(title);
  const titleY = 250 - (lines.length - 1) * 26;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
<defs>
<linearGradient id="bg" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${to}"/><stop offset="1" stop-color="#0b0e14"/></linearGradient>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".36" r=".5"><stop offset="0" stop-color="${from}" stop-opacity=".55"/><stop offset="1" stop-color="${from}" stop-opacity="0"/></radialGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#0b0e14" stop-opacity="0"/><stop offset="1" stop-color="#0b0e14" stop-opacity=".9"/></linearGradient>
</defs>
<rect width="300" height="300" fill="url(#bg)"/>
<rect width="300" height="300" fill="url(#glow)"/>
<g transform="translate(45 -8) scale(.7)">${motif}</g>
<rect width="300" height="300" fill="url(#fade)"/>
${lines
  .map(
    (line, i) =>
      `<text x="150" y="${titleY + i * 26}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="23" fill="#fff">${escapeXml(line.toUpperCase())}</text>`,
  )
  .join('\n')}
<text x="150" y="285" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="2" fill="#fff" fill-opacity=".7">${escapeXml(provider.name.toUpperCase())}</text>
</svg>`;
}
