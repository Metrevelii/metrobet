import { createHash } from 'node:crypto';

/**
 * Test cards of the mock bank. Any other valid number (Luhn) is approved too.
 * Payouts to a card ending in 0119 are refused, to try failed withdrawals.
 */
export const MOCK_TEST_CARDS = [
  { number: '4111 1111 1111 1111', result: 'approved' },
  { number: '5555 5555 5555 4444', result: 'approved' },
  { number: '4000 0000 0000 0002', result: 'declined' },
  { number: '4000 0000 0000 0119', result: 'payouts fail' },
] as const;

export const digitsOf = (value: string) => value.replace(/\D/g, '');

export function luhnValid(number: string): boolean {
  if (!/^\d{16}$/.test(number)) return false;
  let sum = 0;
  for (let index = 0; index < number.length; index += 1) {
    let digit = Number(number[number.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** MM/YY not in the past. */
export function expiryValid(expiry: string, now = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return year * 12 + month >= now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
}

/** What the bank reports for a card: token (reusable, never the number), mask and brand. */
export function tokenise(number: string, expiry: string) {
  return {
    token: `mock:${number.slice(-4)}:${createHash('sha256').update(number).digest('hex').slice(0, 24)}`,
    mask: `${number.slice(0, 6)}••••${number.slice(-4)}`,
    brand: number.startsWith('4') ? 'Visa' : number.startsWith('5') ? 'Mastercard' : 'Card',
    expiry: expiry.trim(),
  };
}

export const declines = (number: string) => number.endsWith('0002');
export const refusesPayouts = (cardToken: string) => cardToken.startsWith('mock:0119:');
