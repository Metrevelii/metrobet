import { mixColor } from './math';

/**
 * Scene colours derived from the design system's tokens, so a theme change recolours Longshot
 * too. Only the "world" follows the theme (sky, hills, wall, clouds, accents); the dragon, fire,
 * wood and iron keep their own art colours.
 */
export type LongshotPalette = {
  skyStops: number[];
  stars: number;
  hills: [number, number];
  wall: number;
  rim: number;
  cloud: number;
  /** Fletching and the speed trail: the brand accent. */
  accent: number;
  accentDark: number;
};

/** Any CSS colour (hex, rgb, oklch…) → 0xRRGGBB, via a 1×1 canvas so the browser parses it. */
function toHex(css: string, fallback: number): number {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || !css) return fallback;
  context.fillStyle = '#000';
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

/** Reads the theme tokens in effect on `element` (render it inside `data-mode="dark"`). */
export function readPalette(element: HTMLElement): LongshotPalette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: number) =>
    toHex(style.getPropertyValue(`--color-${name}`).trim(), fallback);
  const background = token('background', 0x0b0e14);
  const card = token('card', 0x141925);
  const muted = token('muted', 0x1c2333);
  const accent = token('accent', 0x222a3c);
  const primary = token('primary', 0xc6ff3d);
  const foreground = token('foreground', 0xe8ecf4);

  return {
    // Night sky: background at the top, a faint brand-coloured glow on the horizon.
    skyStops: [
      background,
      mixColor(background, card, 0.7),
      mixColor(card, accent, 0.8),
      mixColor(accent, primary, 0.12),
      mixColor(accent, primary, 0.28),
    ],
    stars: foreground,
    hills: [mixColor(card, muted, 0.6), mixColor(background, card, 0.55)],
    wall: mixColor(background, muted, 0.55),
    rim: primary,
    cloud: mixColor(muted, foreground, 0.35),
    accent: primary,
    accentDark: mixColor(primary, background, 0.45),
  };
}
