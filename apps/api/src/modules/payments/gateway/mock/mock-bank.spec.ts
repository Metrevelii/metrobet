import { describe, expect, it } from 'vitest';

import { expiryValid, luhnValid, refusesPayouts, tokenise } from './mock-cards.js';
import { signCheckout, verifyCheckout } from './mock-checkout-token.js';

const secret = 'unit-test-secret-0123456789abcdef0123456789';
const checkout = {
  paymentId: '7d3c9a52-1b9e-4c3e-9a55-0c2f2f9e6a11',
  provider: 'tbc' as const,
  amount: 25_00,
  returnUrl: 'http://localhost:3000/wallet?payment=x',
  exp: Date.now() + 60_000,
};

describe('mock bank', () => {
  it('validates card numbers and expiry dates', () => {
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
    expect(luhnValid('411111')).toBe(false);
    const now = new Date('2026-11-11T00:00:00Z');
    expect(expiryValid('11/26', now)).toBe(true);
    expect(expiryValid('10/26', now)).toBe(false);
    expect(expiryValid('13/30', now)).toBe(false);
  });

  it('tokenises without exposing the number', () => {
    const card = tokenise('4000000000000119', '01/30');
    expect(card.mask).toBe('400000••••0119');
    expect(card.token).not.toContain('4000000000000119');
    expect(refusesPayouts(card.token)).toBe(true);
    expect(refusesPayouts(tokenise('4111111111111111', '01/30').token)).toBe(false);
  });

  it('accepts only untampered, unexpired checkout links', () => {
    const token = signCheckout(secret, checkout);
    expect(verifyCheckout(secret, token)).toEqual(checkout);
    expect(verifyCheckout('another-secret-0123456789abcdef0123456789', token)).toBeNull();
    const [payload, mac] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ ...checkout, amount: 1 })).toString('base64url');
    expect(verifyCheckout(secret, `${tampered}.${mac}`)).toBeNull();
    expect(verifyCheckout(secret, `${payload}.${mac}`, checkout.exp + 1)).toBeNull();
  });
});
