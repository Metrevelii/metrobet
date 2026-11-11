import { randomUUID } from 'node:crypto';

import { Body, Controller, Get, Inject, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';

import type { Env } from '../../../../config/env.js';
import { MockBankCallbacks } from './mock-bank-callbacks.js';
import { declines, digitsOf, expiryValid, luhnValid, tokenise } from './mock-cards.js';
import { renderMockCheckoutPage, renderMockMessagePage } from './mock-checkout-page.js';
import { verifyCheckout } from './mock-checkout-token.js';

const formSchema = z.object({
  t: z.string().max(4000).default(''),
  action: z.enum(['pay', 'cancel']).default('pay'),
  number: z.string().max(40).default(''),
  expiry: z.string().max(10).default(''),
  cvc: z.string().max(10).default(''),
  name: z.string().max(80).default(''),
});

/**
 * The mock bank's hosted card page (TBC / BoG stand-in). In production this page belongs to the
 * bank; here the API serves it so deposits work end to end without a contract.
 */
@Controller('payments/mock')
export class MockBankController {
  private readonly secret: string;
  private readonly csp: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(MockBankCallbacks) private readonly callbacks: MockBankCallbacks,
  ) {
    this.secret = config.get('PAYMENT_GATEWAY_SECRET', { infer: true });
    // The form posts here, then redirects to the player site (form-action covers redirects).
    const site = new URL(config.get('WEB_URL', { infer: true })).origin;
    this.csp = `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${site}; frame-ancestors 'none'`;
  }

  @Get('checkout')
  page(@Query('t') token: string | undefined, @Res() res: Response) {
    const checkout = verifyCheckout(this.secret, token ?? '');
    if (!checkout) return this.message(res, 400);
    return this.html(res, renderMockCheckoutPage({ checkout, token: token! }));
  }

  @Post('checkout')
  async submit(@Body() body: unknown, @Res() res: Response) {
    const form = formSchema.safeParse(body ?? {});
    const checkout = form.success ? verifyCheckout(this.secret, form.data.t) : null;
    if (!form.success || !checkout) return this.message(res, 400);
    const { t, action, expiry, name } = form.data;
    const number = digitsOf(form.data.number);
    const base = { paymentId: checkout.paymentId, amount: checkout.amount };

    if (action === 'cancel') {
      const told = await this.callbacks.notify({
        ...base,
        status: 'cancelled',
        providerReference: `mock-${randomUUID()}`,
        reason: 'Cancelled by the cardholder',
      });
      return told ? res.redirect(303, checkout.returnUrl) : this.message(res, 502);
    }

    const invalid = !luhnValid(number)
      ? 'Check the card number.'
      : !expiryValid(expiry)
        ? 'Check the expiry date (MM/YY).'
        : !/^\d{3}$/.test(form.data.cvc.trim())
          ? 'The CVC is the 3 digits on the back.'
          : null;
    if (invalid) {
      return this.html(
        res,
        renderMockCheckoutPage({
          checkout,
          token: t,
          error: invalid,
          values: { number: form.data.number, expiry, name },
        }),
      );
    }

    const told = await this.callbacks.notify(
      declines(number)
        ? {
            ...base,
            status: 'failed',
            providerReference: `mock-${randomUUID()}`,
            reason: 'The card was declined',
          }
        : {
            ...base,
            status: 'succeeded',
            providerReference: `mock-${randomUUID()}`,
            card: tokenise(number, expiry),
          },
    );
    return told ? res.redirect(303, checkout.returnUrl) : this.message(res, 502);
  }

  private html(res: Response, page: string, status = 200) {
    res
      .status(status)
      .type('html')
      .set({
        'Content-Security-Policy': this.csp,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      })
      .send(page);
  }

  private message(res: Response, status: 400 | 502) {
    this.html(
      res,
      status === 400
        ? renderMockMessagePage(
            'This payment link is not valid',
            'It may have expired. Go back to Metrobet and start the deposit again.',
          )
        : renderMockMessagePage(
            'Metrobet could not be reached',
            'Your card was not charged. Go back to Metrobet and try again.',
          ),
      status,
    );
  }
}
