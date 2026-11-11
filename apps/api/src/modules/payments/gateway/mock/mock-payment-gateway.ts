import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../../../config/env.js';
import {
  type Payout,
  PaymentGateway,
  type PayoutResult,
  type StartDeposit,
} from '../payment-gateway.js';
import { refusesPayouts } from './mock-cards.js';
import { signCheckout } from './mock-checkout-token.js';

/** How long the mock bank's card page link stays valid (the payment itself expires at 30 min). */
const CHECKOUT_TTL_MS = 30 * 60 * 1000;

/**
 * Stand-in for the TBC / BoG gateways: deposits go to the mock bank's hosted card page (served
 * by this API, `MockBankController`), payouts are decided at once.
 */
@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  private readonly secret: string;
  private readonly checkoutUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.secret = config.get('PAYMENT_GATEWAY_SECRET', { infer: true });
    this.checkoutUrl = `${config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '')}/api/payments/mock/checkout`;
  }

  startDeposit(input: StartDeposit): Promise<{ redirectUrl: string }> {
    const token = signCheckout(this.secret, { ...input, exp: Date.now() + CHECKOUT_TTL_MS });
    return Promise.resolve({ redirectUrl: `${this.checkoutUrl}?t=${token}` });
  }

  payout({ cardToken }: Payout): Promise<PayoutResult> {
    return Promise.resolve(
      refusesPayouts(cardToken)
        ? { ok: false, reason: 'The card does not accept payouts' }
        : { ok: true, providerReference: `mock-payout-${randomUUID()}` },
    );
  }
}
