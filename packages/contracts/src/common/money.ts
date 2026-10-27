import { z } from 'zod';

/**
 * Money is always an integer in minor units (tetri for GEL: 1 ₾ = 100), never a float.
 * Convert only at the edges: `toMajor` for display, `toMinor` for input fields.
 */
export const MINOR_PER_MAJOR = 100;

export const minorAmountSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const toMajor = (minor: number) => minor / MINOR_PER_MAJOR;
export const toMinor = (major: number) => Math.round(major * MINOR_PER_MAJOR);
