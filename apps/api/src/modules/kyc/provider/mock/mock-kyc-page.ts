const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export type MockKycValues = Partial<
  Record<
    'documentType' | 'documentNumber' | 'firstName' | 'lastName' | 'personalNumber' | 'dateOfBirth',
    string
  >
>;

const STYLE = `*{box-sizing:border-box}body{margin:0;font:15px/1.4 system-ui,sans-serif;background:#eef1f6;color:#18202c;display:flex;justify-content:center;padding:24px 16px}
main{width:100%;max-width:440px;background:#fff;border-radius:14px;box-shadow:0 8px 30px #0001;overflow:hidden}
header{background:#3b3fd8;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
header b{font-size:18px}.test{font-size:11px;background:#fff3;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em}
form{padding:20px;display:flex;flex-direction:column;gap:14px}.muted{color:#66707d;font-size:13px}
label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600}input,select{font:inherit;padding:11px 12px;border:1px solid #d3d9e0;border-radius:8px;background:#fff}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:13px;cursor:pointer}
.go{background:#3b3fd8;color:#fff}.cancel{background:transparent;color:#66707d}.error{background:#fde8e8;color:#a61b1b;padding:10px 12px;border-radius:8px;font-size:13px}
details{font-size:12px;color:#66707d}ul{margin:6px 0 0;padding-left:18px}`;

/**
 * The mock provider's verification page: in real life a document photo and a selfie; here the
 * player types what the document says. Clearly marked as a test page.
 */
export function renderMockKycPage({
  token,
  error,
  values = {},
}: {
  token: string;
  error?: string;
  values?: MockKycValues;
}) {
  const value = (key: keyof MockKycValues) => escape(values[key] ?? '');
  const selected = (type: string) => (values.documentType === type ? ' selected' : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VerifyID · Identity check</title><style>${STYLE}</style></head><body><main>
<header><b>VerifyID</b><span class="test">Test mode</span></header>
<form method="post" action="verify" autocomplete="off">
<div><div style="font-size:20px;font-weight:700">Verify your identity for Metrobet</div>
<div class="muted">Enter the details exactly as they appear on your document.</div></div>
${error ? `<div class="error" role="alert">${escape(error)}</div>` : ''}
<input type="hidden" name="t" value="${escape(token)}">
<label>Document<select name="documentType"><option value="id_card"${selected('id_card')}>Georgian ID card</option><option value="passport"${selected('passport')}>Passport</option></select></label>
<div class="row"><label>First name<input name="firstName" value="${value('firstName')}" required></label>
<label>Last name<input name="lastName" value="${value('lastName')}" required></label></div>
<label>Personal number<input name="personalNumber" inputmode="numeric" maxlength="11" placeholder="01001012345" value="${value('personalNumber')}" required></label>
<div class="row"><label>Date of birth<input type="date" name="dateOfBirth" value="${value('dateOfBirth')}" required></label>
<label>Document number<input name="documentNumber" value="${value('documentNumber')}" required></label></div>
<button class="go" name="action" value="submit">Submit for verification</button>
<button class="cancel" name="action" value="cancel" formnovalidate>Cancel and return to Metrobet</button>
<details><summary>Test outcomes</summary><ul>
<li>Personal number ending in <b>0000</b>: document rejected</li>
<li>ending in <b>9999</b>: sent to manual review</li>
<li>anything else: approved (if the date of birth matches your account)</li></ul></details>
</form></main></body></html>`;
}

export function renderMockKycMessage(title: string, message: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#eef1f6;color:#18202c;display:flex;justify-content:center;padding:48px 16px}main{max-width:420px;background:#fff;border-radius:14px;padding:24px}</style>
</head><body><main><h1 style="font-size:20px;margin:0 0 8px">${escape(title)}</h1><p style="margin:0;color:#66707d">${escape(message)}</p></main></body></html>`;
}
