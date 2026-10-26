import type { GameType, Locale } from '@metrobet/contracts';

const escapeHtml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

const LABELS: Record<Locale, Record<string, string>> = {
  ka: {
    balance: 'ბალანსი',
    bet: 'ფსონი',
    spin: 'ტრიალი',
    start: 'ფრენა',
    cashout: 'აღება',
    demo: 'დემო რეჟიმი',
    win: 'მოგება',
    crashed: 'გაფრინდა',
  },
  en: {
    balance: 'Balance',
    bet: 'Bet',
    spin: 'Spin',
    start: 'Fly',
    cashout: 'Cash out',
    demo: 'Demo mode',
    win: 'Win',
    crashed: 'Flew away',
  },
  ru: {
    balance: 'Баланс',
    bet: 'Ставка',
    spin: 'Крутить',
    start: 'Полёт',
    cashout: 'Забрать',
    demo: 'Демо-режим',
    win: 'Выигрыш',
    crashed: 'Улетел',
  },
};

const SLOT_SCRIPT = `
const symbols=['🍒','🍋','🔔','💎','7️⃣','⭐'];let balance=1000;const bet=10;
const reels=[...document.querySelectorAll('.reel')],out=document.getElementById('balance'),msg=document.getElementById('msg'),btn=document.getElementById('play');
btn.onclick=()=>{if(balance<bet)return;balance-=bet;btn.disabled=true;msg.textContent='';let ticks=0;
const t=setInterval(()=>{reels.forEach(r=>r.textContent=symbols[Math.random()*symbols.length|0]);if(++ticks>12){clearInterval(t);
const v=reels.map(r=>r.textContent);const win=v[0]===v[1]&&v[1]===v[2]?bet*20:(v[0]===v[1]||v[1]===v[2])?bet*2:0;
balance+=win;out.textContent=balance.toFixed(2);if(win)msg.textContent=L.win+' '+win.toFixed(2);btn.disabled=false;}},70);out.textContent=balance.toFixed(2);};`;

const CRASH_SCRIPT = `
let balance=1000;const bet=10;let m=1,raf,crashAt,flying=false;
const out=document.getElementById('balance'),mult=document.getElementById('mult'),msg=document.getElementById('msg'),btn=document.getElementById('play');
function frame(){m*=1.006;mult.textContent=m.toFixed(2)+'×';if(m>=crashAt){flying=false;mult.classList.add('lost');msg.textContent=L.crashed;btn.textContent=L.start;return;}raf=requestAnimationFrame(frame);}
btn.onclick=()=>{if(flying){cancelAnimationFrame(raf);flying=false;const win=bet*m;balance+=win;out.textContent=balance.toFixed(2);msg.textContent=L.win+' '+win.toFixed(2);btn.textContent=L.start;return;}
if(balance<bet)return;balance-=bet;out.textContent=balance.toFixed(2);m=1;crashAt=1+(-Math.log(Math.random())*1.4);flying=true;mult.classList.remove('lost');msg.textContent='';btn.textContent=L.cashout;frame();};`;

/** Self-contained demo game page standing in for a provider's game client. */
export function renderMockDemoPage(params: {
  title: string;
  provider: string;
  type: GameType;
  locale: Locale;
}): string {
  const l = LABELS[params.locale];
  const crash = params.type === 'crash';
  const stage = crash
    ? '<div id="mult" class="mult">1.00×</div>'
    : '<div class="reels"><div class="reel">🍒</div><div class="reel">💎</div><div class="reel">7️⃣</div></div>';

  return `<!doctype html><html lang="${params.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(params.title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;font-family:system-ui,sans-serif;color:#e8ecf4;background:radial-gradient(circle at 50% 30%,#2a3347,#0b0e14 70%)}
h1{margin:0;font-size:clamp(20px,4vw,36px);text-align:center}.provider{opacity:.6;font-size:13px;letter-spacing:.15em;text-transform:uppercase}
.reels{display:flex;gap:12px}.reel{width:clamp(70px,14vw,120px);aspect-ratio:3/4;display:grid;place-items:center;font-size:clamp(36px,7vw,64px);background:#141925;border:2px solid #2a3347;border-radius:16px}
.mult{font-size:clamp(56px,12vw,120px);font-weight:900;color:#c6ff3d;font-variant-numeric:tabular-nums}.mult.lost{color:#ff4d5e}
.bar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center}.pill{background:#141925;border:1px solid #2a3347;border-radius:10px;padding:8px 14px;font-variant-numeric:tabular-nums}
button{font:inherit;font-weight:800;font-size:18px;padding:14px 40px;border:0;border-radius:12px;background:#c6ff3d;color:#0b0e14;cursor:pointer}button:disabled{opacity:.5}
#msg{min-height:24px;color:#2ee59d;font-weight:700}.demo{position:fixed;top:12px;right:12px;font-size:12px;background:#ffb020;color:#0b0e14;padding:4px 10px;border-radius:999px;font-weight:800}
</style></head><body>
<div class="demo">${l.demo}</div>
<div class="provider">${escapeHtml(params.provider)}</div>
<h1>${escapeHtml(params.title)}</h1>
${stage}
<div id="msg"></div>
<div class="bar"><span class="pill">${l.balance}: <b id="balance">1000.00</b></span><span class="pill">${l.bet}: 10.00</span><button id="play">${crash ? l.start : l.spin}</button></div>
<script>const L=${JSON.stringify(l)};${crash ? CRASH_SCRIPT : SLOT_SCRIPT}</script>
</body></html>`;
}
