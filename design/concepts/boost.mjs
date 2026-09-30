// Boost-round storyboards for Star Pilots (direction A): intro, Warp Drive live + MAX, Firework Frenzy MAX, Bubble Blast live.
import { starPath, rng, f } from './lib.mjs';
import { P, bgStars, css as baseCss, fonts, pilot, planetSvg, ship, star } from './a.mjs';

const css = baseCss + `
.bo-title{position:absolute;left:0;right:0;text-align:center;font-family:'Titan One';color:#fff;line-height:1;margin:0}
.bo-meter{position:absolute;left:260px;top:26px;width:760px;height:44px;border-radius:22px;background:#0C0830;box-shadow:0 0 0 4px #2B1E86,0 0 0 7px rgba(157,144,255,.4),0 0 30px rgba(255,210,63,.25)}
.bo-fill{position:absolute;left:5px;top:5px;bottom:5px;border-radius:17px;background:linear-gradient(90deg,#FF5DA2,#FF9F43 45%,#FFD23F);box-shadow:0 0 18px rgba(255,210,63,.8);overflow:hidden}
.bo-fill::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.35) 0 10px,transparent 10px 26px);animation:bo-slide 0.6s linear infinite}
@keyframes bo-slide{to{background-position:31px 0}}
.bo-notch{position:absolute;top:-14px;width:4px;height:72px;margin-left:-2px;background:rgba(255,255,255,.35);border-radius:2px}
.bo-tierstar{position:absolute;top:-30px;margin-left:-22px}
.bo-timer{position:absolute;right:30px;top:14px}
.bo-row{position:absolute;left:0;right:0;bottom:6px;height:170px}
.bo-saucer{position:absolute;bottom:0;display:flex;flex-direction:column;align-items:center;animation:bo-jig .35s ease-in-out infinite alternate}
.bo-saucer:nth-child(2){animation-delay:-.12s}.bo-saucer:nth-child(3){animation-delay:-.2s}.bo-saucer:nth-child(4){animation-delay:-.07s}
@keyframes bo-jig{from{transform:translateY(0)}to{transform:translateY(-7px)}}
.bo-heat{position:absolute;bottom:-20px;width:200px;height:60px;border-radius:50%;filter:blur(18px)}
.bo-bolts{position:absolute;left:0;top:0}
.bo-bolts path{animation:bo-zap .5s linear infinite}
@keyframes bo-zap{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-120}}
.bo-burst{position:absolute;font-family:'Titan One';color:#FFD23F;-webkit-text-stroke:0;text-shadow:0 6px 0 #5A2A00,0 0 30px rgba(255,210,63,.8);transform:rotate(-6deg);animation:bo-pulse 1s ease-in-out infinite}
@keyframes bo-pulse{50%{transform:rotate(-6deg) scale(1.08)}}
.bo-warp line{animation:bo-rush 0.5s linear infinite}
@keyframes bo-rush{from{stroke-dashoffset:0}to{stroke-dashoffset:-400}}
.bo-core{animation:bo-throb .4s ease-in-out infinite alternate}
@keyframes bo-throb{to{opacity:.7}}
.bo-flame{transform-origin:50% 0;animation:bo-flame .12s linear infinite alternate}
@keyframes bo-flame{to{transform:scaleY(1.25)}}
.bo-count{position:absolute;left:0;right:0;top:250px;text-align:center;font-family:'Titan One';font-size:220px;color:#FFD23F;line-height:1;text-shadow:0 12px 0 #5A2A00,0 0 80px rgba(255,210,63,.7)}
.bo-bubble{animation:bo-wobble 1.1s ease-in-out infinite}
@keyframes bo-wobble{0%,100%{transform:scale(1,1)}30%{transform:scale(1.03,.97)}60%{transform:scale(.98,1.02)}}
.bo-glass{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(255,255,255,.0) 30%,rgba(8,5,31,.55) 100%)}
`;

function sky(seed, extra = '') {
  return `<div class="a-neb a-neb1"></div><div class="a-neb a-neb2"></div><div class="a-neb a-neb3"></div>${bgStars(seed)}${extra}`;
}

const xs = n => ({ 1: [640], 2: [440, 840], 3: [300, 640, 980], 4: [200, 490, 790, 1080] }[n]);

function saucerRow(heat, moods = []) {
  const pos = xs(heat.length);
  return `<div class="bo-row">${heat.map((h, i) => `<div class="bo-saucer" style="left:${pos[i] - 75}px"><div class="bo-heat" style="background:${P[i].c};opacity:${h}"></div>${pilot(i, moods[i] ?? 'cheer', 150)}</div>`).join('')}</div>`;
}

function bolts(targetX, targetY, heat) {
  const pos = xs(heat.length);
  return `<svg class="bo-bolts" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">${pos.map((x, i) => {
    const d = `M${x} 590 Q ${(x + targetX) / 2 + (i % 2 ? 60 : -60)} ${(590 + targetY) / 2} ${targetX} ${targetY}`;
    return `<path d="${d}" stroke="${P[i].c}" stroke-width="${6 + heat[i] * 8}" stroke-linecap="round" fill="none" stroke-dasharray="26 34" opacity="${0.4 + heat[i] * 0.6}" style="filter:drop-shadow(0 0 8px ${P[i].c})"/>`;
  }).join('')}</svg>`;
}

function meter(pct, tier) {
  const stars = [1 / 3, 2 / 3, 1].map((t, i) => {
    const lit = i < tier;
    return `<span class="bo-notch" style="left:${5 + 750 * t}px"></span><span class="bo-tierstar" style="left:${5 + 750 * t}px"><svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><path d="${starPath(22, 23, 20, 8.5)}" fill="${lit ? '#FFD23F' : '#2B1E86'}" stroke="${lit ? '#FFF0A8' : '#6E62C9'}" stroke-width="3" stroke-linejoin="round" style="${lit ? 'filter:drop-shadow(0 0 10px #FFD23F)' : ''}"/></svg></span>`;
  }).join('');
  return `<div class="bo-meter"><div class="bo-fill" style="width:${f(750 * pct)}px"></div>${stars}</div>`;
}

function timer(pct) {
  const r = 28, c = 2 * Math.PI * r;
  return `<svg class="bo-timer" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true"><circle cx="36" cy="36" r="${r}" fill="#0C0830" stroke="#2B1E86" stroke-width="8"/><circle cx="36" cy="36" r="${r}" fill="none" stroke="#36D6FF" stroke-width="8" stroke-linecap="round" stroke-dasharray="${f(c * pct)} ${f(c)}" transform="rotate(-90 36 36)"/></svg>`;
}

function streaks(seed, cx, cy, n, minR, maxR, width, colours) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, r0 = minR + r() * (maxR - minR) * 0.5, len = 80 + r() * (maxR - minR);
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0, x2 = cx + Math.cos(a) * (r0 + len), y2 = cy + Math.sin(a) * (r0 + len);
    const col = colours[i % colours.length];
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${f(width * (0.4 + r()))}" stroke-linecap="round" stroke-dasharray="${f(len * 0.6)} 400" opacity="${f(0.5 + r() * 0.5)}"/>`;
  }
  return s;
}

function firework(seed, cx, cy, radius, colour, rays = 18, kind = 'peony') {
  const r = rng(seed);
  let s = `<circle cx="${cx}" cy="${cy}" r="${radius * 0.18}" fill="#fff" opacity=".9" style="filter:blur(6px)"/>`;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + r() * 0.1;
    for (let k = 1; k <= 6; k++) {
      const d = radius * (k / 6) * (kind === 'willow' ? 1 : 0.95 + r() * 0.1);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + (kind === 'willow' ? k * k * 1.6 : 0);
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + (6 - k) * 0.9)}" fill="${k > 4 ? '#fff' : colour}" opacity="${f(1 - k * 0.1)}"/>`;
    }
  }
  return s;
}

function gloop(w = 300, cheeks = 1) {
  return `<svg viewBox="0 0 300 300" width="${w}" height="${w}" aria-hidden="true">
<ellipse cx="150" cy="286" rx="110" ry="12" fill="#000" opacity=".25"/>
<path d="M40 280 C 20 190 50 70 150 64 C 250 70 280 190 260 280 Q 230 292 205 280 Q 180 294 150 281 Q 120 294 95 280 Q 70 292 40 280Z" fill="#9B5CF6"/>
<path d="M62 250 C 50 180 80 96 150 90 C 110 110 88 170 96 250Z" fill="#fff" opacity=".18"/>
<circle cx="112" cy="140" r="30" fill="#fff"/><circle cx="188" cy="140" r="30" fill="#fff"/>
<circle cx="118" cy="146" r="15" fill="#1A1446"/><circle cx="182" cy="146" r="15" fill="#1A1446"/>
<circle cx="123" cy="140" r="5" fill="#fff"/><circle cx="187" cy="140" r="5" fill="#fff"/>
<ellipse cx="92" cy="${196}" rx="${16 * cheeks}" ry="${11 * cheeks}" fill="#FF7EC8" opacity=".8"/><ellipse cx="208" cy="196" rx="${16 * cheeks}" ry="${11 * cheeks}" fill="#FF7EC8" opacity=".8"/>
<ellipse cx="150" cy="210" rx="16" ry="12" fill="#6B2FC9"/>
<path d="M150 64 Q 146 34 128 24" stroke="#9B5CF6" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="126" cy="22" r="10" fill="#D6B8FF"/>
</svg>`;
}

function bubble(size) {
  return `<svg class="bo-bubble" viewBox="0 0 400 400" width="${size}" height="${size}" aria-hidden="true" style="transform-origin:50% 90%">
<defs><radialGradient id="bo-gum" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#FFD1EC"/><stop offset=".55" stop-color="#FF7EC8"/><stop offset="1" stop-color="#E0449C"/></radialGradient></defs>
<circle cx="200" cy="200" r="190" fill="url(#bo-gum)" opacity=".92"/>
<path d="M90 120 A150 150 0 0 1 180 60" stroke="#fff" stroke-width="18" stroke-linecap="round" fill="none" opacity=".75"/>
<circle cx="102" cy="168" r="12" fill="#fff" opacity=".7"/>
<path d="M300 300 A150 150 0 0 1 250 340" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none" opacity=".35"/>
</svg>`;
}

const board = (title, body) => ({ title, fonts, css, body: `<div class="a-root" style="width:1280px;height:720px">${body}</div>`, w: 1280, h: 720 });

export function intro() {
  return board('Boost intro — countdown', `${sky(31)}
<p class="bo-title" style="top:70px;font-size:96px;text-shadow:0 8px 0 #2B1E86,0 0 40px rgba(255,93,162,.6);transform:rotate(-3deg)">BOOST ROUND!</p>
<p class="bo-title" style="top:176px;font-size:40px;color:#36D6FF;font-family:'Baloo 2';font-weight:800">Warp Drive</p>
<p class="bo-count">3</p>
${saucerRow([0.3, 0.3, 0.3, 0.3], ['idle', 'idle', 'idle', 'idle'])}`);
}

export function warpLive() {
  const heat = [0.9, 0.6, 1, 0.45];
  return board('Warp Drive — live, tier 2', `${sky(41)}
<svg class="bo-warp" viewBox="0 0 1280 720" width="1280" height="720" style="position:absolute;left:0;top:0" aria-hidden="true">${streaks(5, 640, 300, 70, 160, 700, 3, ['#fff', '#AEEFFF', '#FFD3A6'])}</svg>
${bolts(640, 300, heat)}
<div style="position:absolute;left:440px;top:120px;width:400px;height:360px">
<svg viewBox="0 0 400 360" width="400" height="360" aria-hidden="true" style="position:absolute;left:0;top:0">
<g class="bo-flame"><path d="M150 250 Q 160 330 175 250Z" fill="#FFD23F"/><path d="M225 250 Q 240 330 250 250Z" fill="#FFD23F"/><path d="M158 250 Q 162 300 170 250Z" fill="#fff"/><path d="M232 250 Q 240 300 244 250Z" fill="#fff"/></g>
</svg>
<div style="position:absolute;left:0;top:0;transform:scale(1.9);transform-origin:0 0">${ship()}</div>
<svg class="bo-core" viewBox="0 0 400 360" width="400" height="360" aria-hidden="true" style="position:absolute;left:0;top:0"><circle cx="200" cy="200" r="120" fill="#FFD23F" opacity=".35" style="filter:blur(24px)"/></svg>
</div>
${meter(0.72, 2)}${timer(0.45)}
<p class="bo-burst" style="left:830px;top:96px;font-size:64px">SUPER!</p>
${saucerRow(heat)}`);
}

export function warpMax() {
  return board('Warp Drive — MAX: hyperspace', `<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#FFFBE0 0%,#FFD23F 6%,#7A2BD8 26%,#130B45 62%,#050314 100%)"></div>
<svg class="bo-warp" viewBox="0 0 1280 720" width="1280" height="720" style="position:absolute;left:0;top:0" aria-hidden="true">${streaks(9, 640, 330, 320, 10, 900, 5, ['#fff', '#FFD23F', '#FF5DA2', '#36D6FF', '#9DF26B', '#FF9F43'])}</svg>
<div style="position:absolute;left:585px;top:285px;transform:scale(.55);transform-origin:0 0">${ship()}</div>
<div class="bo-glass"></div>
<p class="bo-title" style="top:560px;font-size:110px;color:#FFD23F;text-shadow:0 10px 0 #5A2A00,0 0 60px rgba(255,210,63,.9)">HYPERSPACE!</p>`);
}

export function fireworksMax() {
  const r = rng(77);
  let shells = '';
  const cols = ['#FF5DA2', '#36D6FF', '#FF9F43', '#9DF26B', '#FFD23F', '#fff'];
  for (let i = 0; i < 14; i++) shells += firework(100 + i, f(90 + r() * 1100), f(90 + r() * 330), f(50 + r() * 70), cols[i % cols.length], 16, i % 4 === 0 ? 'willow' : 'peony');
  const face = firework(999, 640, 250, 170, '#FFD23F', 34);
  return board('Firework Frenzy — MAX: grand finale', `${sky(55)}
<svg viewBox="0 0 1280 720" width="1280" height="720" style="position:absolute;left:0;top:0" aria-hidden="true">
${shells}${face}
<g transform="translate(640 250)"><circle cx="-52" cy="-30" r="18" fill="#fff"/><circle cx="52" cy="-30" r="18" fill="#fff"/><path d="M-80 30 Q 0 110 80 30" stroke="#fff" stroke-width="14" fill="none" stroke-linecap="round"/></g>
<path d="M0 720 L0 650 Q 640 560 1280 650 L1280 720Z" fill="#E08A1E"/><path d="M0 660 Q 640 572 1280 660" stroke="#FFD23F" stroke-width="6" fill="none" opacity=".6"/>
</svg>
<p class="bo-title" style="top:466px;font-size:92px;color:#fff;text-shadow:0 8px 0 #2B1E86,0 0 40px rgba(255,255,255,.7)">MEGA BOOST!</p>
${saucerRow([1, 1, 1, 1])}`);
}

export function bubbleLive() {
  const heat = [0.7, 1, 0.55, 0.85];
  return board('Bubble Blast — live, about to POP', `${sky(63)}
${bolts(640, 250, heat)}
<div style="position:absolute;left:490px;top:250px">${gloop(300, 1.3)}</div>
<div style="position:absolute;left:420px;top:40px;width:440px;height:440px;opacity:.9">${bubble(440)}</div>
${meter(0.93, 2)}${timer(0.2)}
<p class="bo-burst" style="left:70px;top:210px;font-size:58px;color:#FF7EC8;text-shadow:0 6px 0 #6B2FC9,0 0 30px rgba(255,126,200,.8)">KEEP GOING!</p>
${saucerRow(heat)}`);
}
