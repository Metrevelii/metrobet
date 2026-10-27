import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 256-bit random token, URL-safe. */
export const generateToken = () => randomBytes(32).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Uniform 6-digit code (leading zeros allowed). */
export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
