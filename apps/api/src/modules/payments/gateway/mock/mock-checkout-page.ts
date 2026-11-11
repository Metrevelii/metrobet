import { toMajor } from '@metrobet/contracts';

import type { Checkout } from './mock-checkout-token.js';
import { MOCK_TEST_CARDS } from './mock-cards.js';

const BANKS = {
  tbc: { name: 'TBC Pay', accent: '#00a3e0' },
  bog: { name: 'BoG Pay', accent: '#ff6b00' },
} as const;

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

type PageInput = {
  checkout: Checkout;
  token: string;
  error?: string;
  values?: { number?: string; expiry?: string; name?: string };
};

/**
 * The mock bank's hosted card page (a plain form, no script). Clearly marked as a test page;
 * card data never reaches Metrobet, only the bank's callback does.
 */
export function renderMockCheckoutPage({ checkout, token, error, values = {} }: PageInput) {
  const bank = BANKS[checkout.provider];
  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GEL' }).format(
    toMajor(checkout.amount),
  );
  const cards = MOCK_TEST_CARDS.map(
    (card) => `<li><code>${card.number}</code> ${card.result}</li>`,
  ).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${bank.name} · Test payment</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px/1.4 system-ui,sans-serif;background:#f3f5f8;color:#1b2430;display:flex;justify-content:center;padding:24px 16px}
main{width:100%;max-width:400px;background:#fff;border-radius:14px;box-shadow:0 8px 30px #0001;overflow:hidden}
header{background:${bank.accent};color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
header b{font-size:18px}.test{font-size:11px;background:#fff3;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em}
form{padding:20px;display:flex;flex-direction:column;gap:14px}.amount{font-size:28px;font-weight:700}.muted{color:#66707d;font-size:13px}
label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600}input{font:inherit;padding:11px 12px;border:1px solid #d3d9e0;border-radius:8px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:13px;cursor:pointer}
.pay{background:${bank.accent};color:#fff}.cancel{background:transparent;color:#66707d}.error{background:#fde8e8;color:#a61b1b;padding:10px 12px;border-radius:8px;font-size:13px}
details{font-size:12px;color:#66707d}code{font-size:12px}ul{margin:6px 0 0;padding-left:18px}
</style></head><body><main>
<header><b>${bank.name}</b><span class="test">Test mode</span></header>
<form method="post" action="checkout" autocomplete="off">
<div><div class="muted">Pay to Metrobet</div><div class="amount">${amount}</div></div>
${error ? `<div class="error" role="alert">${escape(error)}</div>` : ''}
<input type="hidden" name="t" value="${escape(token)}">
<label>Card number<input name="number" inputmode="numeric" placeholder="4111 1111 1111 1111" value="${escape(values.number ?? '')}" required></label>
<div class="row"><label>Expiry<input name="expiry" placeholder="MM/YY" value="${escape(values.expiry ?? '')}" required></label>
<label>CVC<input name="cvc" inputmode="numeric" placeholder="123" required></label></div>
<label>Name on card<input name="name" value="${escape(values.name ?? '')}"></label>
<button class="pay" name="action" value="pay">Pay ${amount}</button>
<button class="cancel" name="action" value="cancel" formnovalidate>Cancel and return to Metrobet</button>
<details><summary>Test cards (any future expiry, any CVC)</summary><ul>${cards}</ul></details>
</form></main></body></html>`;
}

/** Shown when the link is broken or expired, or the merchant could not be told. */
export function renderMockMessagePage(title: string, message: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#f3f5f8;color:#1b2430;display:flex;justify-content:center;padding:48px 16px}main{max-width:400px;background:#fff;border-radius:14px;padding:24px}</style>
</head><body><main><h1 style="font-size:20px;margin:0 0 8px">${escape(title)}</h1><p style="margin:0;color:#66707d">${escape(message)}</p></main></body></html>`;
}
