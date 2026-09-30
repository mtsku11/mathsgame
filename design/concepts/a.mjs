// Direction A — Star Pilots: glowing arcade space, dark high-contrast sky.
import { starPath, marker, icons, rng, f } from './lib.mjs';

export const fonts = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Titan+One&display=swap';
const ink = '#1A1446';
export const P = [
  { c: '#FF5DA2', l: '#FFB3D4', name: 'Pink pilot' },
  { c: '#36D6FF', l: '#AEEFFF', name: 'Blue pilot' },
  { c: '#FF9F43', l: '#FFD3A6', name: 'Orange pilot' },
  { c: '#9DF26B', l: '#D6FBC0', name: 'Green pilot' },
];

export function pilot(i, mood = 'happy', w = 132) {
  const { c, l } = P[i];
  let eyes, mouth, arms = '';
  if (mood === 'cheer') {
    eyes = `<path d="M49 58 Q57 47 65 58" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M75 58 Q83 47 91 58" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M57 67 Q70 90 83 67 Z" fill="${ink}"/><path d="M62 76 Q70 84 78 76 Q70 72 62 76Z" fill="#FF7FA8"/>`;
    arms = `<path d="M44 70 Q36 60 40 46" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M96 70 Q104 60 100 46" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="40" cy="44" r="7" fill="${l}"/><circle cx="100" cy="44" r="7" fill="${l}"/>`;
  } else if (mood === 'think') {
    eyes = `<circle cx="58" cy="58" r="10" fill="#fff"/><circle cx="82" cy="58" r="10" fill="#fff"/><circle cx="61" cy="53" r="5" fill="${ink}"/><circle cx="85" cy="53" r="5" fill="${ink}"/><path d="M76 42 Q84 38 92 43" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    mouth = `<ellipse cx="73" cy="75" rx="4" ry="5" fill="${ink}"/>`;
  } else {
    eyes = `<circle cx="58" cy="58" r="10" fill="#fff"/><circle cx="82" cy="58" r="10" fill="#fff"/><circle cx="59" cy="60" r="5.5" fill="${ink}"/><circle cx="83" cy="60" r="5.5" fill="${ink}"/><circle cx="61" cy="57" r="2" fill="#fff"/><circle cx="85" cy="57" r="2" fill="#fff"/>`;
    mouth = `<path d="M62 71 Q70 79 78 71" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 140 124" width="${w}" height="${f(w * 124 / 140)}" aria-hidden="true">
<ellipse cx="70" cy="116" rx="44" ry="6" fill="${c}" opacity=".35"/>
<ellipse cx="70" cy="90" rx="62" ry="17" fill="#3F32A8"/>
<path d="M70 32 Q64 18 56 14" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="55" cy="13" r="6" fill="${l}"/>
<path d="M84 34 Q92 22 100 20" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="101" cy="19" r="5" fill="${l}"/>
${arms}
<circle cx="70" cy="64" r="31" fill="${c}"/>
<ellipse cx="62" cy="48" rx="12" ry="7" fill="#fff" opacity=".28"/>
<ellipse cx="50" cy="70" rx="6" ry="4" fill="#fff" opacity=".35"/><ellipse cx="90" cy="70" rx="6" ry="4" fill="#fff" opacity=".35"/>
${eyes}${mouth}
<path d="M23 90 A47 47 0 0 1 117 90 Z" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
<path d="M36 72 A36 36 0 0 1 56 50" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round" fill="none"/>
<ellipse cx="70" cy="95" rx="65" ry="16" fill="#CFC8FF"/>
<ellipse cx="70" cy="90" rx="58" ry="9" fill="#EFEBFF"/>
<circle cx="24" cy="99" r="4" fill="${c}"/><circle cx="46" cy="104" r="4" fill="${c}"/><circle cx="70" cy="106" r="4" fill="${c}"/><circle cx="94" cy="104" r="4" fill="${c}"/><circle cx="116" cy="99" r="4" fill="${c}"/>
</svg>`;
}

export function star(size = 60, cls = '') {
  return `<svg class="a-star ${cls}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><path d="${starPath(50, 54, 44, 19)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="9" stroke-linejoin="round"/><path d="${starPath(50, 54, 26, 11)}" fill="#FFF0A8" opacity=".75"/></svg>`;
}

export function planetSvg(kind, size) {
  const k = {
    ring: `<circle cx="50" cy="50" r="30" fill="#FFB84D"/><path d="M26 44 Q50 36 74 44" stroke="#E08A1E" stroke-width="5" fill="none" opacity=".6"/><path d="M28 58 Q50 52 72 58" stroke="#E08A1E" stroke-width="4" fill="none" opacity=".5"/><ellipse cx="50" cy="52" rx="46" ry="11" fill="none" stroke="#FFE08A" stroke-width="5" transform="rotate(-14 50 52)"/>`,
    candy: `<circle cx="50" cy="50" r="34" fill="#FF6FB5"/><circle cx="38" cy="40" r="7" fill="#FF9CCB"/><circle cx="62" cy="60" r="10" fill="#E54C97"/><circle cx="60" cy="34" r="4" fill="#FFC2DF"/><path d="M22 60 Q50 72 78 58" stroke="#FFC2DF" stroke-width="4" fill="none" opacity=".7"/>`,
    ice: `<circle cx="50" cy="50" r="30" fill="#4FA8FF"/><path d="M28 40 Q50 30 72 40" stroke="#BFE3FF" stroke-width="6" fill="none" opacity=".8"/><circle cx="60" cy="58" r="6" fill="#2F7FE0"/>`,
  }[kind];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${k}</svg>`;
}

export const css = `
body{margin:0}
*{box-sizing:border-box}
.a-root{position:relative;width:1280px;height:720px;overflow:hidden;background:radial-gradient(ellipse 80% 70% at 50% 55%,#231566 0%,#130B45 55%,#08051F 100%);font-family:'Baloo 2',system-ui,sans-serif;color:#fff}
.a-neb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.5}
.a-neb1{left:-120px;top:380px;width:560px;height:360px;background:#7A2BD8}
.a-neb2{left:760px;top:-140px;width:620px;height:380px;background:#E0368E;opacity:.32}
.a-neb3{left:420px;top:260px;width:460px;height:300px;background:#2A7DE1;opacity:.22}
.a-sky{position:absolute;inset:0}
.a-tw{animation:a-twinkle 3.2s ease-in-out infinite}
@keyframes a-twinkle{0%,100%{opacity:.95}50%{opacity:.2}}
.a-hud{position:absolute;left:0;top:0;right:0;height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 28px}
.a-logo{display:flex;align-items:center;gap:12px}
.a-logo b{font-family:'Titan One',system-ui;font-weight:400;font-size:28px;letter-spacing:.5px;line-height:1;display:block}
.a-logo small{display:block;font-size:16px;font-weight:700;color:#C4BAFF;line-height:1.2}
.a-route{position:absolute;left:470px;top:8px}
.a-pause{width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);display:grid;place-items:center;cursor:pointer}
.a-st{position:absolute;width:516px;height:300px;border-radius:32px;background:linear-gradient(180deg,rgba(46,32,124,.82),rgba(22,14,72,.88));border:3px solid color-mix(in oklab,var(--c) 70%,transparent);box-shadow:0 0 0 6px rgba(8,5,31,.55),0 0 38px color-mix(in oklab,var(--c) 32%,transparent),inset 0 1px 0 rgba(255,255,255,.14)}
.a-p0{--c:#FF5DA2}.a-p1{--c:#36D6FF}.a-p2{--c:#FF9F43}.a-p3{--c:#9DF26B}
.a-st.is-done{border-color:#FFD23F;box-shadow:0 0 0 6px rgba(8,5,31,.55),0 0 54px rgba(255,210,63,.55),inset 0 1px 0 rgba(255,255,255,.14)}
.a-pilot{position:absolute;left:-16px;top:-36px;animation:a-bob 3.4s ease-in-out infinite}
.a-p1 .a-pilot{animation-delay:-.8s}.a-p2 .a-pilot{animation-delay:-1.7s}.a-p3 .a-pilot{animation-delay:-2.4s}
.a-st.is-done .a-pilot{animation:a-hop .9s ease-in-out infinite}
@keyframes a-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
@keyframes a-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) rotate(-3deg)}}
.a-shape{position:absolute;left:112px;top:18px;filter:drop-shadow(0 0 8px var(--c))}
.a-q{position:absolute;left:124px;width:364px;top:16px;height:140px;display:flex;flex-direction:column;align-items:center;gap:4px}
.a-prompt{margin:0;font-size:30px;font-weight:800;line-height:44px;color:#fff}
.a-eq{margin:0;font-family:'Titan One';font-size:40px;line-height:44px;letter-spacing:2px}
.a-objs{display:flex;align-items:center;gap:10px;height:84px}
.a-grp{display:flex;gap:4px}
.a-plus{font-family:'Titan One';font-size:34px;color:#C4BAFF;margin:0 6px}
.a-star{filter:drop-shadow(0 0 10px rgba(255,210,63,.55))}
.a-count{display:flex;flex-direction:column;align-items:center;gap:0}
.a-count i{font-style:normal;font-family:'Titan One';font-size:18px;width:26px;height:26px;border-radius:50%;background:#fff;color:${ink};display:grid;place-items:center;margin-top:-6px}
.a-ans{position:absolute;left:124px;width:364px;top:164px;display:flex;justify-content:center;align-items:center;gap:48px}
.a-btn{position:relative;width:116px;height:116px;border-radius:50%;border:0;padding:0;cursor:pointer;font-family:'Titan One',system-ui;font-size:64px;line-height:1;color:#fff;text-shadow:0 4px 0 rgba(26,20,70,.5);background:radial-gradient(circle at 50% 38%,color-mix(in oklab,var(--c) 45%,white) 0%,var(--c) 48%,color-mix(in oklab,var(--c) 62%,#1A1446) 100%);box-shadow:0 0 0 7px #0C0830,0 0 0 10px color-mix(in oklab,var(--c) 50%,#0C0830),0 9px 0 8px #0C0830,0 0 40px color-mix(in oklab,var(--c) 40%,transparent)}
.a-btn::before{content:'';position:absolute;left:22%;top:10%;width:42%;height:24%;border-radius:50%;background:rgba(255,255,255,.45);transform:rotate(-18deg)}
.a-btn span{position:relative}
.a-live .a-btn::after{content:'';position:absolute;inset:-20px;border-radius:50%;border:3px solid var(--c);opacity:0;animation:a-ring 2.8s ease-out infinite}
.a-live .a-btn+.a-btn::after{animation-delay:1.4s}
@keyframes a-ring{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.2);opacity:0}}
.a-btn.is-right{--c:#FFD23F;color:#5A2A00;text-shadow:0 2px 0 rgba(255,255,255,.5);box-shadow:0 0 0 7px #0C0830,0 0 0 10px #FFB020,0 9px 0 8px #0C0830,0 0 70px rgba(255,210,63,.9);animation:a-pop 1.8s ease-in-out infinite}
@keyframes a-pop{0%,100%{transform:scale(1)}12%{transform:scale(1.12)}24%{transform:scale(.97)}36%{transform:scale(1.03)}}
.a-btn.is-dim{filter:saturate(.3) brightness(.55)}
.a-btn.is-try{animation:a-wobble 3s ease-in-out infinite}
@keyframes a-wobble{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-7deg)}84%{transform:rotate(6deg)}92%{transform:rotate(-3deg)}}
.a-chev{position:absolute;top:50%;margin-top:-9px;opacity:.7}
.a-teach{position:absolute;left:18px;bottom:18px;display:flex;gap:8px}
.a-teach button{width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);display:grid;place-items:center;cursor:pointer;padding:0}
.a-pill{position:absolute;left:14px;top:98px;margin:0;white-space:nowrap;padding:4px 14px;border-radius:999px;font-weight:800;font-size:17px;line-height:26px}
.a-pill.gold{background:#FFD23F;color:#4A2300}
.a-pill.soft{background:rgba(255,255,255,.14);color:#fff;border:2px solid rgba(255,255,255,.25)}
.a-burst{position:absolute;width:0;height:0}
.a-burst span{position:absolute;left:-9px;top:-9px;animation:a-spark 1.8s ease-out infinite}
@keyframes a-spark{0%{transform:translate(0,0) scale(.3);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1);opacity:0}}
.a-beams path{fill:none;stroke-width:4;stroke-linecap:round;stroke-dasharray:2 14;animation:a-flow 1.4s linear infinite;opacity:.7}
@keyframes a-flow{to{stroke-dashoffset:-32}}
.a-hub{position:absolute;left:540px;top:92px;width:200px;height:616px}
.a-dest{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:center}
.a-dest p{margin:0;font-weight:800;font-size:18px;color:#FFC2DF;line-height:1.1;text-align:center}
.a-dest svg{animation:a-spin 30s linear infinite}
@keyframes a-spin{to{transform:rotate(360deg)}}
.a-ship{position:absolute;left:-5px;top:208px;animation:a-float 4s ease-in-out infinite}
@keyframes a-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.a-core{animation:a-glow 2.2s ease-in-out infinite}
@keyframes a-glow{0%,100%{opacity:.55}50%{opacity:1}}
.a-pips{position:absolute;left:0;right:0;top:432px;display:flex;justify-content:center;gap:7px}
.a-pips i{width:24px;height:24px;display:block}
.a-round{position:absolute;left:0;right:0;top:462px;text-align:center;font-weight:700;font-size:17px;color:#C4BAFF}
.a-fly{position:absolute;left:0;top:0;offset-path:path('M224 342 C 300 190 470 250 640 400');offset-rotate:0deg;animation:a-fly 2.6s cubic-bezier(.45,0,.3,1) infinite}
@keyframes a-fly{0%{offset-distance:0%;transform:scale(1);opacity:0}8%{opacity:1}85%{opacity:1;transform:scale(.7)}100%{offset-distance:100%;transform:scale(.4);opacity:0}}
.a-trail{position:absolute;left:0;top:0;width:1280px;height:720px;pointer-events:none}
/* kit */
.a-kit h2{margin:0 0 14px;font-size:20px;font-weight:800;color:#C4BAFF;line-height:1}
.a-kit .row{display:flex;gap:18px;align-items:flex-end}
.a-kit figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.a-kit figcaption{font-size:16px;font-weight:700;color:#E8E3FF;display:flex;align-items:center;gap:6px}
.a-sw{width:78px;display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:700;color:#E8E3FF;line-height:1.1}
.a-sw i{display:block;width:78px;height:56px;border-radius:16px;border:2px solid rgba(255,255,255,.2)}
.a-sw small{font-weight:600;color:#A99FE8}
.a-nums{font-family:'Titan One';font-size:52px;line-height:1;display:flex;gap:20px;color:#fff}
.a-mini{width:112px;height:63px;border-radius:10px;background:#0C0830;border:2px solid rgba(255,255,255,.2);position:relative;overflow:hidden}
.a-mini i{position:absolute;border-radius:6px;border:2px solid var(--c);background:color-mix(in oklab,var(--c) 22%,#1B1250)}
.a-mini b{position:absolute;border-radius:50%;background:#FFD23F;box-shadow:0 0 10px #FFD23F}
.a-note{font-size:17px;font-weight:600;color:#E8E3FF;line-height:1.45;margin:0;max-width:560px}
`;

export function bgStars(seed) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < 110; i++) {
    const x = f(r() * 1280), y = f(r() * 720), rad = f(0.6 + r() * 1.8);
    const tw = r() < 0.35;
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#fff" opacity="${f(0.35 + r() * 0.6)}" ${tw ? `class="a-tw" style="animation-delay:-${f(r() * 3)}s"` : ''}/>`;
  }
  for (let i = 0; i < 7; i++) {
    const x = f(r() * 1280), y = f(r() * 720);
    s += `<path class="a-tw" style="animation-delay:-${f(r() * 3)}s" d="${starPath(x, y, 7, 2, 4, -90)}" fill="#fff"/>`;
  }
  return `<svg class="a-sky" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">${s}</svg>`;
}

function route() {
  return `<svg class="a-route" viewBox="0 0 340 70" width="340" height="70" aria-hidden="true">
<path d="M58 35 H170" stroke="#FFD23F" stroke-width="4" stroke-linecap="round"/>
<path d="M170 35 H282" stroke="#8F84E8" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 11"/>
<g transform="translate(28 5)">${planetSvg('ring', 60).replace('<svg', '<svg x="0" y="0"')}</g>
<circle cx="170" cy="35" r="31" fill="none" stroke="#FF6FB5" stroke-width="3" opacity=".6" class="a-core"/>
<g transform="translate(140 5)">${planetSvg('candy', 60)}</g>
<g transform="translate(252 5)" opacity=".45">${planetSvg('ice', 60)}</g>
<path d="${starPath(75, 16, 8, 3.4)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
}

export function ship() {
  return `<svg viewBox="0 0 210 210" width="210" height="210" aria-hidden="true">
<defs><radialGradient id="a-core" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#FFFBE0"/><stop offset=".45" stop-color="#FFD23F"/><stop offset="1" stop-color="#FF8A1E"/></radialGradient>
<radialGradient id="a-halo" cx="50%" cy="50%" r="50%"><stop offset=".5" stop-color="#FFD23F" stop-opacity=".55"/><stop offset="1" stop-color="#FFD23F" stop-opacity="0"/></radialGradient></defs>
<circle class="a-core" cx="105" cy="105" r="104" fill="url(#a-halo)"/>
<path d="M9 108 A96 30 0 0 1 201 108" stroke="#5B4BD6" stroke-width="12" fill="none" stroke-linecap="round"/>
<circle cx="105" cy="105" r="64" fill="#2B1E86" stroke="#9D90FF" stroke-width="5"/>
<circle cx="105" cy="105" r="52" fill="url(#a-core)"/>
<ellipse cx="88" cy="80" rx="18" ry="10" fill="#fff" opacity=".55" transform="rotate(-25 88 80)"/>
<text x="105" y="126" text-anchor="middle" font-family="Titan One" font-size="56" fill="#5A2A00">7</text>
<path d="M9 108 A96 30 0 0 0 201 108" stroke="#B3A8FF" stroke-width="12" fill="none" stroke-linecap="round"/>
<circle cx="30" cy="121" r="4" fill="#FFD23F"/><circle cx="62" cy="133" r="4" fill="#FF5DA2"/><circle cx="105" cy="138" r="4" fill="#36D6FF"/><circle cx="148" cy="133" r="4" fill="#FF9F43"/><circle cx="180" cy="121" r="4" fill="#9DF26B"/>
</svg>`;
}

function pips(done, current) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = starPath(12, 13, 11, 4.8);
    if (i < done) return `<i><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="#FFD23F" stroke="#FFD23F" stroke-width="2" stroke-linejoin="round"/></svg></i>`;
    if (i === current) return `<i class="a-core"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke="#FFD23F" stroke-width="2.4" stroke-linejoin="round"/></svg></i>`;
    return `<i><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke="#6E62C9" stroke-width="2.4" stroke-linejoin="round"/></svg></i>`;
  }).join('');
}

function burst() {
  const pts = [[0, -84], [60, -60], [84, 0], [60, 60], [0, 84], [-60, 60], [-84, 0], [-60, -60]];
  return `<div class="a-burst" style="left:224px;top:222px">${pts.map(([x, y], k) => `<span style="--x:${x}px;--y:${y}px;animation-delay:${f(k * 0.04)}s"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="${starPath(10, 10, 9, 3.6)}" fill="${k % 2 ? '#FFFFFF' : '#FFD23F'}"/></svg></span>`).join('')}</div>`;
}

function station(i, left, top, q) {
  const { mood, state } = q;
  const objs = q.kind === 'count'
    ? `<p class="a-prompt">How many?</p><div class="a-objs">${Array.from({ length: q.n }, (_, k) => state === 'help' ? `<span class="a-count">${star(54)}<i>${k + 1}</i></span>` : star(60)).join('')}</div>`
    : `<p class="a-eq">${q.a} + ${q.b} = ?</p><div class="a-objs"><span class="a-grp">${Array.from({ length: q.a }, () => star(42)).join('')}</span><span class="a-plus">+</span><span class="a-grp">${Array.from({ length: q.b }, () => star(42)).join('')}</span></div>`;
  const btn = side => {
    const cls = state === 'done' ? (side === q.correct ? 'is-right' : 'is-dim') : state === 'help' && side === q.tried ? 'is-try' : '';
    return `<button class="a-btn ${cls}" aria-label="Player ${i + 1} ${side ? 'right' : 'left'} answer, ${q.choices[side]}"><span>${q.choices[side]}</span></button>`;
  };
  const pill = state === 'done' ? '<p class="a-pill gold">Star sent!</p>' : state === 'help' ? '<p class="a-pill soft">Count with me</p>' : '';
  return `<section class="a-st a-p${i} ${state === 'done' ? 'is-done' : ''} ${state === 'wait' ? 'a-live' : ''}" style="left:${left}px;top:${top}px" aria-label="Player ${i + 1}">
<div class="a-pilot">${pilot(i, mood)}</div>
<div class="a-shape">${marker(i, P[i].c, 26)}</div>
${pill}
<div class="a-q">${objs}</div>
<div class="a-ans"><span class="a-chev" style="left:6px">${icons.chevL('#C4BAFF')}</span>${btn(0)}${btn(1)}<span class="a-chev" style="right:6px">${icons.chevR('#C4BAFF')}</span></div>
<div class="a-teach"><button aria-label="Help player ${i + 1}">${icons.help('#C4BAFF')}</button><button aria-label="Pass player ${i + 1}">${icons.pass('#C4BAFF')}</button></div>
</section>`;
}

export function game() {
  const body = `<div class="a-root" style="width:1280px;height:720px">
<div class="a-neb a-neb1"></div><div class="a-neb a-neb2"></div><div class="a-neb a-neb3"></div>
${bgStars(7)}
<svg class="a-trail a-beams" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
<path d="M540 236 C 590 250 600 330 612 372" stroke="#FFD23F" style="opacity:1"/>
<path d="M740 236 C 690 250 680 330 668 372" stroke="#36D6FF"/>
<path d="M540 566 C 590 552 600 470 612 432" stroke="#FF9F43"/>
<path d="M740 566 C 690 552 680 470 668 432" stroke="#9DF26B"/>
</svg>
<header class="a-hud">
<div class="a-logo"><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2B1E86" stroke="#9D90FF" stroke-width="3"/><path d="${starPath(24, 25.5, 15, 6.5)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="3" stroke-linejoin="round"/></svg><div><b>Number Crew</b><small>Star Pilots</small></div></div>
${route()}
<button class="a-pause" aria-label="Pause game (teacher)">${icons.pause('#fff')}</button>
</header>
<div class="a-hub">
<div class="a-dest">${planetSvg('candy', 150)}<p>Candy Planet</p></div>
<div class="a-ship">${ship()}</div>
<div class="a-pips">${pips(2, 2)}</div>
<p class="a-round" style="margin:0">Round 3 of 6</p>
</div>
${station(0, 24, 92, { kind: 'count', n: 4, choices: [4, 3], correct: 0, state: 'done', mood: 'cheer' })}
${station(1, 740, 92, { kind: 'add', a: 2, b: 3, choices: [6, 5], correct: 1, state: 'wait', mood: 'happy' })}
${station(2, 24, 408, { kind: 'count', n: 3, choices: [2, 3], correct: 1, tried: 0, state: 'help', mood: 'think' })}
${station(3, 740, 408, { kind: 'add', a: 4, b: 1, choices: [5, 4], correct: 0, state: 'wait', mood: 'happy' })}
<div style="position:absolute;left:24px;top:92px">${burst()}</div>
<div class="a-fly">${star(46)}</div>
</div>`;
  return { title: 'A · Star Pilots — play', fonts, css, body, w: 1280, h: 720 };
}

function mini(n) {
  const cs = P.map(p => p.c);
  const box = (x, y, w, h, c) => `<i style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--c:${c}"></i>`;
  const hub = (x, y, r) => `<b style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px"></b>`;
  const L = {
    1: box(10, 10, 62, 39, cs[0]) + hub(88, 30, 9),
    2: box(6, 10, 38, 39, cs[0]) + box(64, 10, 38, 39, cs[1]) + hub(54, 30, 7),
    3: box(6, 6, 38, 21, cs[0]) + box(64, 6, 38, 21, cs[1]) + box(6, 33, 38, 21, cs[2]) + hub(54, 30, 7),
    4: box(6, 6, 38, 21, cs[0]) + box(64, 6, 38, 21, cs[1]) + box(6, 33, 38, 21, cs[2]) + box(64, 33, 38, 21, cs[3]) + hub(54, 30, 7),
  };
  return `<figure><div class="a-mini">${L[n]}</div><figcaption>${n} ${n === 1 ? 'player' : 'players'}</figcaption></figure>`;
}

export function kit() {
  const states = [
    ['Ready', 'a-live', ''],
    ['Pressed', '', 'style="transform:translateY(6px);box-shadow:0 0 0 7px #0C0830,0 0 0 10px color-mix(in oklab,var(--c) 50%,#0C0830),0 3px 0 8px #0C0830"'],
    ['Right answer', '', 'class-right'],
    ['Try again', '', 'class-try'],
  ];
  const body = `<div class="a-root a-kit" style="width:1280px;height:720px">
<div class="a-neb a-neb1"></div><div class="a-neb a-neb2"></div>
${bgStars(19)}
<div style="position:absolute;left:56px;top:48px;width:600px;display:flex;flex-direction:column;gap:34px">
<div class="a-logo"><svg viewBox="0 0 48 48" width="72" height="72" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2B1E86" stroke="#9D90FF" stroke-width="3"/><path d="${starPath(24, 25.5, 15, 6.5)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="3" stroke-linejoin="round"/></svg><div><b style="font-size:52px">Number Crew</b><small style="font-size:22px">Star Pilots</small></div></div>
<div><h2>The crew</h2><div class="row" style="gap:10px">${P.map((p, i) => `<figure>${pilot(i, i === 0 ? 'cheer' : i === 2 ? 'think' : 'happy', 132)}<figcaption>${marker(i, p.c, 20)}${p.name}</figcaption></figure>`).join('')}</div></div>
<div><h2>Answer buttons</h2><div class="row" style="gap:44px;padding-left:14px">${states.map(([label, wrap, extra], k) => `<figure class="${wrap} a-p0" style="gap:26px"><button class="a-btn ${extra === 'class-right' ? 'is-right' : extra === 'class-try' ? 'is-try' : ''}" ${extra.startsWith('style') ? extra : ''} aria-label="${label} example"><span>${k === 2 ? 4 : 3}</span></button><figcaption>${label}</figcaption></figure>`).join('')}</div></div>
</div>
<div style="position:absolute;left:720px;top:52px;width:520px;display:flex;flex-direction:column;gap:30px">
<div><h2>Colour</h2><div class="row" style="gap:10px">${[['#130B45', 'Deep space'], ['#FFD23F', 'Star gold'], ['#FF5DA2', 'Pink'], ['#36D6FF', 'Blue'], ['#FF9F43', 'Orange'], ['#9DF26B', 'Green']].map(([h, n]) => `<div class="a-sw"><i style="background:${h}"></i>${n}<small>${h}</small></div>`).join('')}</div></div>
<div><h2>Numbers · Titan One</h2><div class="a-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<span>${n}</span>`).join('')}</div></div>
<div><h2>Things to count</h2><div class="row" style="gap:26px;align-items:center">${star(64)}<span style="display:flex;gap:4px">${star(40)}${star(40)}${star(40)}</span><span class="a-plus" style="margin:0">+</span><span style="display:flex;gap:4px">${star(40)}${star(40)}</span></div></div>
<div><h2>One to four players</h2><div class="row" style="gap:14px">${[1, 2, 3, 4].map(mini).join('')}</div></div>
<p class="a-note">Feels like: a bright arcade at night. Stars twinkle, pods bob, each right answer beams a star into the mothership. Sound: soft synth chimes and a warp whoosh between planets.</p>
</div>
</div>`;
  return { title: 'A · Star Pilots — kit', fonts, css, body, w: 1280, h: 720 };
}
