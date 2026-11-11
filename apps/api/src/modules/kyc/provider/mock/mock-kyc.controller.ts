import { randomUUID } from 'node:crypto';

import { idDocumentTypeSchema, type KycCallback, kycPersonSchema } from '@metrobet/contracts';
import { Body, Controller, Get, Inject, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';

import type { Env } from '../../../../config/env.js';
import { MockKycCallbacks } from './mock-kyc-callbacks.js';
import { renderMockKycMessage, renderMockKycPage } from './mock-kyc-page.js';
import { verifyKycSession } from './mock-kyc-token.js';

const field = z.string().max(100).default('');
const formSchema = z.object({
  t: z.string().max(4000).default(''),
  action: z.enum(['submit', 'cancel']).default('submit'),
  documentType: idDocumentTypeSchema.catch('id_card'),
  documentNumber: field,
  firstName: field,
  lastName: field,
  personalNumber: field,
  dateOfBirth: field,
});

/** What the mock provider decides, from the personal number (see the page's test outcomes). */
function outcomeFor(personalNumber: string): KycCallback['outcome'] {
  if (personalNumber.endsWith('0000')) return 'rejected';
  if (personalNumber.endsWith('9999')) return 'review';
  return 'approved';
}

/**
 * The mock KYC provider's hosted page. In production this belongs to the provider (document
 * photo, selfie, liveness); here the API serves it so verification works end to end.
 */
@Controller('kyc/mock')
export class MockKycController {
  private readonly secret: string;
  private readonly csp: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(MockKycCallbacks) private readonly callbacks: MockKycCallbacks,
  ) {
    this.secret = config.get('KYC_PROVIDER_SECRET', { infer: true });
    const site = new URL(config.get('WEB_URL', { infer: true })).origin;
    this.csp = `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${site}; frame-ancestors 'none'`;
  }

  @Get('verify')
  page(@Query('t') token: string | undefined, @Res() res: Response) {
    if (!verifyKycSession(this.secret, token ?? '')) return this.invalid(res);
    return this.html(res, renderMockKycPage({ token: token! }));
  }

  @Post('verify')
  async submit(@Body() body: unknown, @Res() res: Response) {
    const form = formSchema.safeParse(body ?? {});
    const session = form.success ? verifyKycSession(this.secret, form.data.t) : null;
    if (!form.success || !session) return this.invalid(res);
    const { t, action, ...values } = form.data;
    if (action === 'cancel') return res.redirect(303, session.returnUrl);

    const person = kycPersonSchema.safeParse(values);
    if (!person.success) {
      return this.html(
        res,
        renderMockKycPage({
          token: t,
          values,
          error:
            'Check the details: the personal number has 11 digits and every field is required.',
        }),
      );
    }
    const outcome = outcomeFor(person.data.personalNumber);
    const told = await this.callbacks.notify({
      checkId: session.checkId,
      outcome,
      providerReference: `mock-kyc-${randomUUID()}`,
      ...(outcome === 'rejected'
        ? { reason: 'The document could not be verified' }
        : { person: person.data }),
      ...(outcome === 'review' && { reason: 'The photo is blurry; a person should check it' }),
    });
    if (!told) {
      return this.html(
        res,
        renderMockKycMessage('Metrobet could not be reached', 'Go back to Metrobet and try again.'),
        502,
      );
    }
    return res.redirect(303, session.returnUrl);
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

  private invalid(res: Response) {
    this.html(
      res,
      renderMockKycMessage(
        'This verification link is not valid',
        'It may have expired. Go back to Metrobet and start again.',
      ),
      400,
    );
  }
}
