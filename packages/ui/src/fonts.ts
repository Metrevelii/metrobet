import { Geist, Geist_Mono, Noto_Sans_Georgian } from 'next/font/google';

// Geist has no Georgian glyphs, so Noto Sans Georgian is stacked after it
// (see --mb-font-sans in the theme). Browsers fall back per glyph.
const brand = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-brand' });
const brandMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-brand-mono' });
const georgian = Noto_Sans_Georgian({ subsets: ['georgian'], variable: '--font-georgian' });

/** Apply to <html> so the theme's font tokens resolve. */
export const fontVariables = [brand.variable, brandMono.variable, georgian.variable].join(' ');
