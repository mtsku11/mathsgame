// Direction C — Glow Reef: calm underwater light, soft shapes, low stimulation.
import { marker, icons, rng, f } from './lib.mjs';

const fonts = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
const ink = '#0B2E45';
const P = [
  { c: '#FF8A7A', d: '#E86A5B', l: '#FFC4BA', name: 'Octopus' },
  { c: '#FFD166', d: '#EDB23E', l: '#FFF0C4', name: 'Pufferfish' },
  { c: '#62E3B4', d: '#33BD8E', l: '#C4F7E4', name: 'Turtle' },
  { c: '#C7A8FF', d: '#A583F0', l: '#E9DDFF', name: 'Jellyfish' },
];

function face(mood, lx, rx, y, r = 11) {
  if (mood === 'cheer') return `<path d="M${lx - 9} ${y + 2} Q${lx} ${y - 10} ${lx + 9} ${y + 2}" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M${rx - 9} ${y + 2} Q${rx} ${y - 10} ${rx + 9} ${y + 2}" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M${(lx + rx) / 2 - 11} ${y + 14} Q${(lx + rx) / 2} ${y + 32} ${(lx + rx) / 2 + 11} ${y + 14} Z" fill="${ink}"/>`;
  const px = mood === 'think' ? 3 : 1, py = mood === 'think' ? -4 : 2;
  const eyes = `<circle cx="${lx}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${rx}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${lx + px}" cy="${y + py}" r="${r * 0.55}" fill="${ink}"/><circle cx="${rx + px}" cy="${y + py}" r="${r * 0.55}" fill="${ink}"/><circle cx="${lx + px + 2}" cy="${y + py - 3}" r="2.2" fill="#fff"/><circle cx="${rx + px + 2}" cy="${y + py - 3}" r="2.2" fill="#fff"/>`;
  const mouth = mood === 'think' ? `<ellipse cx="${(lx + rx) / 2 + 2}" cy="${y + 19}" rx="4" ry="4.5" fill="${ink}"/>` : `<path d="M${(lx + rx) / 2 - 7} ${y + 16} Q${(lx + rx) / 2} ${y + 23} ${(lx + rx) / 2 + 7} ${y + 16}" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return eyes + mouth;
}

export function creature(i, mood = 'happy', w = 148) {
  const { c, d, l } = P[i];
  let art;
  if (i === 0) art = `<g stroke="${c}" stroke-width="15" stroke-linecap="round" fill="none"><path d="M42 90 Q26 110 38 128"/><path d="M58 96 Q50 118 60 132"/><path d="M80 96 Q88 118 78 132"/><path d="M96 90 Q112 110 100 128"/></g>
<g fill="${l}"><circle cx="36" cy="116" r="2.6"/><circle cx="55" cy="118" r="2.6"/><circle cx="84" cy="118" r="2.6"/><circle cx="104" cy="116" r="2.6"/></g>
<ellipse cx="69" cy="62" rx="45" ry="43" fill="${c}"/><ellipse cx="52" cy="38" rx="15" ry="9" fill="#fff" opacity=".35"/><circle cx="96" cy="46" r="5" fill="${d}"/><circle cx="104" cy="60" r="3" fill="${d}"/>
<ellipse cx="41" cy="82" rx="7.5" ry="4.5" fill="${l}"/><ellipse cx="97" cy="82" rx="7.5" ry="4.5" fill="${l}"/>${face(mood, 55, 83, 66, 12)}`;
  else if (i === 1) {
    let spikes = '';
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, b = 0.16;
      const p = (r, t) => `${f(66 + r * Math.cos(t))} ${f(74 + r * Math.sin(t))}`;
      spikes += `<path d="M${p(42, a - b)} L${p(56, a)} L${p(42, a + b)}Z" fill="${d}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    art = `${spikes}<path d="M104 74 L132 56 Q126 74 132 92Z" fill="${d}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/><circle cx="66" cy="74" r="45" fill="${c}"/><ellipse cx="66" cy="96" rx="32" ry="17" fill="${l}"/><ellipse cx="50" cy="48" rx="14" ry="8" fill="#fff" opacity=".4"/><ellipse cx="94" cy="84" rx="11" ry="6" fill="${d}" transform="rotate(-20 94 84)"/>${face(mood, 52, 80, 66, 12)}`;
  } else if (i === 2) art = `<ellipse cx="24" cy="104" rx="18" ry="9" fill="${d}" transform="rotate(-24 24 104)"/><ellipse cx="116" cy="104" rx="18" ry="9" fill="${d}" transform="rotate(24 116 104)"/>
<ellipse cx="70" cy="102" rx="52" ry="31" fill="#2A9E7B"/><ellipse cx="70" cy="100" rx="44" ry="24" fill="#3CC196"/>
<g fill="#2A9E7B" opacity=".75"><rect x="44" y="92" width="15" height="15" rx="4"/><rect x="63" y="88" width="15" height="15" rx="4"/><rect x="82" y="92" width="15" height="15" rx="4"/></g>
<circle cx="70" cy="56" r="33" fill="${c}"/><ellipse cx="56" cy="36" rx="12" ry="7" fill="#fff" opacity=".4"/><ellipse cx="46" cy="70" rx="6.5" ry="4" fill="${l}"/><ellipse cx="94" cy="70" rx="6.5" ry="4" fill="${l}"/>${face(mood, 58, 82, 54, 10.5)}`;
  else art = `<g stroke="${d}" stroke-width="6" stroke-linecap="round" fill="none"><path d="M44 84 q-8 12 0 24 q8 12 0 24"/><path d="M62 88 q-7 12 0 22 q7 12 0 22"/><path d="M80 88 q7 12 0 22 q-7 12 0 22"/><path d="M98 84 q8 12 0 24 q-8 12 0 24"/></g>
<path d="M22 84 Q22 26 70 24 Q118 26 118 84 Q108 94 98 85 Q88 95 79 85 Q70 95 61 85 Q52 95 42 85 Q32 94 22 84Z" fill="${c}"/><ellipse cx="70" cy="46" rx="34" ry="16" fill="#fff" opacity=".22"/><ellipse cx="50" cy="38" rx="12" ry="6" fill="#fff" opacity=".4"/>
<ellipse cx="42" cy="72" rx="6.5" ry="4" fill="${l}"/><ellipse cx="98" cy="72" rx="6.5" ry="4" fill="${l}"/>${face(mood, 56, 84, 58, 10.5)}`;
  return `<svg viewBox="0 0 140 140" width="${w}" height="${w}" aria-hidden="true">${art}</svg>`;
}

export function fish(size = 52) {
  return `<svg class="c-fish" viewBox="0 0 60 44" width="${size}" height="${f(size * 44 / 60)}" aria-hidden="true"><path d="M16 22 L3 9 Q7 22 3 35Z" fill="#FFB14D" stroke="#FFB14D" stroke-width="3" stroke-linejoin="round"/><path d="M26 10 Q34 1 42 9Z" fill="#FFB14D"/><ellipse cx="33" cy="22" rx="21" ry="14" fill="#FFD86B"/><path d="M20 26 Q33 36 48 26" stroke="#FFF1B8" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="43" cy="18" r="4.4" fill="${ink}"/><circle cx="44.5" cy="16.5" r="1.5" fill="#fff"/></svg>`;
}

function coral(x, state) {
  const lit = state !== 'dark';
  const a = lit ? '#FF8A7A' : '#155266', b = lit ? '#FFB38A' : '#124A5D', g = lit ? '#7FE8D6' : '#16566A';
  const cls = state === 'lit' ? 'c-lit' : state === 'glow' ? 'c-lit c-pulse' : '';
  return `<g class="${cls}" transform="translate(${x} 0)">
<g stroke="${a}" stroke-width="10" stroke-linecap="round" fill="none"><path d="M0 690 V640 Q0 624 -14 614"/><path d="M0 652 Q14 640 16 620"/><path d="M-6 632 Q-20 626 -24 606"/></g>
<g fill="${g}"><circle cx="-38" cy="668" r="15"/><circle cx="-24" cy="676" r="11"/></g>
<g fill="${b}"><ellipse cx="34" cy="672" rx="16" ry="20"/><ellipse cx="46" cy="680" rx="10" ry="13"/></g>
</g>`;
}

const css = `
body{margin:0}
*{box-sizing:border-box}
.c-root{position:relative;width:1280px;height:720px;overflow:hidden;font-family:Fredoka,system-ui,sans-serif;color:#fff;background:linear-gradient(180deg,#2B93A8 0%,#176F88 34%,#0F506C 68%,#0A3A55 100%)}
.c-ray{position:absolute;top:-80px;height:760px;background:linear-gradient(180deg,rgba(210,255,248,.22),rgba(210,255,248,0) 78%);transform-origin:50% 0;animation:c-sway 11s ease-in-out infinite alternate}
@keyframes c-sway{from{transform:rotate(12deg)}to{transform:rotate(4deg)}}
.c-kelp{position:absolute;bottom:60px;transform-origin:50% 100%;animation:c-kelp 7s ease-in-out infinite alternate}
@keyframes c-kelp{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
.c-bub{position:absolute;bottom:-30px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);animation:c-rise linear infinite}
@keyframes c-rise{from{transform:translateY(0)}to{transform:translateY(-800px)}}
.c-floor{position:absolute;left:0;top:0}
.c-lit{filter:drop-shadow(0 0 10px rgba(255,200,160,.8))}
.c-pulse{animation:c-pulse 2.4s ease-in-out infinite}
@keyframes c-pulse{0%,100%{opacity:.55}50%{opacity:1}}
.c-hud{position:absolute;left:0;right:0;top:0;height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 36px}
.c-logo{display:flex;align-items:center;gap:12px}
.c-logo b{display:block;font-weight:700;font-size:30px;line-height:1}
.c-logo small{display:block;font-weight:600;font-size:17px;color:#9FF0E2;line-height:1.2}
.c-zone{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
.c-zone p{margin:0;font-weight:600;font-size:20px;line-height:1}
.c-zone div{display:flex;gap:10px;align-items:center}
.c-zone i{display:block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.6)}
.c-zone i.done{background:#FFE27A;border-color:#FFE27A}
.c-zone i.now{width:18px;height:18px;border-color:#FFE27A;box-shadow:0 0 12px #FFE27A}
.c-pause{width:58px;height:58px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(255,255,255,.14);display:grid;place-items:center;cursor:pointer;padding:0}
.c-st{position:absolute;width:588px;height:256px;border-radius:48px;background:rgba(210,245,255,.12);border:2px solid rgba(255,255,255,.3);box-shadow:inset 0 0 0 5px color-mix(in oklab,var(--c) 38%,transparent),0 18px 40px rgba(3,25,40,.3);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.c-p0{--c:#FF8A7A}.c-p1{--c:#FFD166}.c-p2{--c:#62E3B4}.c-p3{--c:#C7A8FF}
.c-st.is-done{background:rgba(255,236,170,.16);border-color:rgba(255,226,122,.8);box-shadow:inset 0 0 0 5px rgba(255,226,122,.55),0 0 50px rgba(255,226,122,.35)}
.c-cr{position:absolute;top:50%;margin-top:-80px;animation:c-float 5.5s ease-in-out infinite}
.c-p1 .c-cr{animation-delay:-1.2s}.c-p2 .c-cr{animation-delay:-2.6s}.c-p3 .c-cr{animation-delay:-3.8s}
@keyframes c-float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
.c-shape{position:absolute;top:22px}
.c-q{position:absolute;top:14px;height:118px;width:400px;display:flex;flex-direction:column;align-items:center;gap:2px}
.c-prompt{margin:0;font-weight:600;font-size:30px;line-height:44px}
.c-eq{margin:0;font-weight:700;font-size:40px;line-height:44px;letter-spacing:1px}
.c-objs{display:flex;align-items:center;gap:10px;height:72px}
.c-grp{display:flex;gap:2px}
.c-plus{font-weight:700;font-size:34px;margin:0 4px;color:#D9FFF7}
.c-fish{filter:drop-shadow(0 0 8px rgba(255,216,107,.55))}
.c-count{display:flex;flex-direction:column;align-items:center}
.c-count i{font-style:normal;font-weight:700;font-size:17px;width:26px;height:26px;border-radius:50%;background:#fff;color:${ink};display:grid;place-items:center;margin-top:-2px}
.c-ans{position:absolute;top:136px;width:400px;display:flex;justify-content:center;gap:56px}
.c-btn{position:relative;width:106px;height:106px;border-radius:50%;border:0;cursor:pointer;padding:0;font-family:Fredoka;font-weight:700;font-size:58px;line-height:1;color:${ink};background:radial-gradient(circle at 36% 30%,#FFFFFF 0 10%,#F1F8FC 32%,#D3E6F0 72%,#B5CEDD 100%);box-shadow:0 0 0 6px var(--c),0 0 0 11px rgba(255,255,255,.16),0 12px 26px rgba(3,25,40,.45),inset 0 -8px 14px rgba(110,150,180,.35)}
.c-btn span{position:relative}
.c-live .c-btn::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:3px solid var(--c);animation:c-ripple 3.2s ease-out infinite;opacity:0}
.c-live .c-btn+.c-btn::after{animation-delay:1.6s}
@keyframes c-ripple{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.35);opacity:0}}
.c-btn.is-right{background:radial-gradient(circle at 36% 30%,#FFFFFF 0 10%,#FFF6D6 34%,#FFE27A 80%,#F5C94C 100%);box-shadow:0 0 0 6px #FFE27A,0 0 0 11px rgba(255,226,122,.3),0 0 48px 12px rgba(255,226,122,.55);animation:c-glow 2.6s ease-in-out infinite}
@keyframes c-glow{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.c-btn.is-right::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:3px solid #FFE27A;animation:c-ripple 2s ease-out infinite}
.c-btn.is-dim{opacity:.4}
.c-btn.is-try{animation:c-nudge 3.4s ease-in-out infinite}
@keyframes c-nudge{0%,70%,100%{transform:translateX(0)}78%{transform:translateX(-6px)}86%{transform:translateX(5px)}94%{transform:translateX(-2px)}}
.c-teach{position:absolute;top:18px;display:flex;gap:8px}
.c-teach button{width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);display:grid;place-items:center;cursor:pointer;padding:0}
.c-pill{position:absolute;bottom:18px;margin:0;padding:3px 14px;border-radius:999px;font-weight:600;font-size:17px;line-height:26px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.3);white-space:nowrap}
.c-pill.gold{background:#FFE27A;color:${ink};border-color:#FFE27A}
.c-pearl{position:absolute;left:600px;top:618px;width:80px;height:80px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:40px;color:${ink};background:radial-gradient(circle at 36% 30%,#fff 0 12%,#FFF6D6 38%,#FFE27A 85%);box-shadow:0 0 36px 10px rgba(255,226,122,.45)}
.c-swim{position:absolute;left:0;top:0;offset-path:path('M296 300 C 480 300 640 330 640 440 S 560 600 470 642');animation:c-swim 5s ease-in-out infinite}
@keyframes c-swim{0%{offset-distance:0%;opacity:0}8%{opacity:1}88%{opacity:1}100%{offset-distance:100%;opacity:0}}
/* kit */
.c-kit h2{margin:0 0 12px;font-size:20px;font-weight:600;color:#9FF0E2;line-height:1}
.c-kit .row{display:flex;gap:18px;align-items:flex-end}
.c-kit figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.c-kit figcaption{font-size:17px;font-weight:600;display:flex;align-items:center;gap:6px}
.c-sw{width:78px;display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:600;line-height:1.1}
.c-sw i{display:block;width:78px;height:56px;border-radius:20px;border:2px solid rgba(255,255,255,.3)}
.c-sw small{font-weight:500;color:#BDEFF0}
.c-nums{font-weight:700;font-size:54px;line-height:1;display:flex;gap:20px}
.c-mini{width:112px;height:63px;border-radius:12px;background:linear-gradient(180deg,#2B93A8,#0A3A55);border:2px solid rgba(255,255,255,.3);position:relative;overflow:hidden}
.c-mini i{position:absolute;border-radius:9px;background:rgba(255,255,255,.2);border:2px solid var(--c)}
.c-mini b{position:absolute;left:0;right:0;bottom:0;height:8px;background:#FF8A7A;opacity:.7}
.c-note{font-size:18px;font-weight:500;line-height:1.45;margin:0;max-width:560px;color:#E6FFFB}
`;

function scenery(seed, withFloor = true) {
  const r = rng(seed);
  const rays = [[120, 150], [360, 110], [640, 180], [900, 120], [1120, 160]].map(([x, w], k) => `<div class="c-ray" style="left:${x}px;width:${w}px;animation-delay:-${k * 2.3}s"></div>`).join('');
  const bubbles = Array.from({ length: 16 }, () => {
    const s = f(8 + r() * 18);
    return `<span class="c-bub" style="left:${f(r() * 1260)}px;width:${s}px;height:${s}px;animation-duration:${f(12 + r() * 10)}s;animation-delay:-${f(r() * 20)}s"></span>`;
  }).join('');
  const kelp = (x, h, flip) => `<svg class="c-kelp" style="left:${x}px;animation-delay:-${f(r() * 5)}s" viewBox="0 0 80 ${h}" width="80" height="${h}" aria-hidden="true"><path d="M40 ${h} C ${flip ? 10 : 70} ${h * 0.75} ${flip ? 70 : 10} ${h * 0.5} 40 ${h * 0.28} S ${flip ? 20 : 60} 30 44 0" stroke="#0C4658" stroke-width="16" fill="none" stroke-linecap="round"/><g fill="#0C4658"><ellipse cx="${flip ? 56 : 24}" cy="${h * 0.62}" rx="16" ry="7" transform="rotate(${flip ? 30 : -30} ${flip ? 56 : 24} ${h * 0.62})"/><ellipse cx="${flip ? 24 : 56}" cy="${h * 0.4}" rx="15" ry="6" transform="rotate(${flip ? -30 : 30} ${flip ? 24 : 56} ${h * 0.4})"/></g></svg>`;
  const floor = withFloor ? `<svg class="c-floor" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true"><path d="M0 668 Q 160 640 320 662 T 640 654 T 960 660 T 1280 646 V720 H0Z" fill="#0B4257"/><path d="M0 668 Q 160 640 320 662 T 640 654 T 960 660 T 1280 646" stroke="#1C6479" stroke-width="4" fill="none"/>
${coral(110, 'lit')}${coral(290, 'lit')}${coral(470, 'glow')}${coral(810, 'dark')}${coral(990, 'dark')}${coral(1170, 'dark')}</svg>` : '';
  return rays + kelp(-24, 460, false) + kelp(1224, 520, true) + bubbles + floor;
}

function station(i, left, top, q) {
  const { mood, state } = q;
  const creatureLeft = i % 2 === 0;
  const contentX = creatureLeft ? 170 : 18;
  const objs = q.kind === 'count'
    ? `<p class="c-prompt">How many?</p><div class="c-objs">${Array.from({ length: q.n }, (_, k) => state === 'help' ? `<span class="c-count">${fish(52)}<i>${k + 1}</i></span>` : fish(60)).join('')}</div>`
    : `<p class="c-eq">${q.a} + ${q.b} = ?</p><div class="c-objs"><span class="c-grp">${Array.from({ length: q.a }, () => fish(44)).join('')}</span><span class="c-plus">+</span><span class="c-grp">${Array.from({ length: q.b }, () => fish(44)).join('')}</span></div>`;
  const btn = side => {
    const cls = state === 'done' ? (side === q.correct ? 'is-right' : 'is-dim') : state === 'help' && side === q.tried ? 'is-try' : '';
    return `<button class="c-btn ${cls}" aria-label="Player ${i + 1} ${side ? 'right' : 'left'} answer, ${q.choices[side]}"><span>${q.choices[side]}</span></button>`;
  };
  const pill = state === 'done' ? '<p class="c-pill gold">Fish found!</p>' : state === 'help' ? '<p class="c-pill">Count with me</p>' : '';
  const side = creatureLeft ? 'left' : 'right';
  return `<section class="c-st c-p${i} ${state === 'done' ? 'is-done' : ''} ${state === 'wait' ? 'c-live' : ''}" style="left:${left}px;top:${top}px" aria-label="Player ${i + 1}">
<div class="c-cr" style="${side}:6px">${creature(i, mood, 156)}</div>
<div class="c-shape" style="${side}:${creatureLeft ? 150 : 150}px">${marker(i, P[i].c, 24)}</div>
<div class="c-q" style="left:${contentX}px">${objs}</div>
<div class="c-ans" style="left:${contentX}px">${btn(0)}${btn(1)}</div>
<div class="c-teach" style="${creatureLeft ? 'right' : 'left'}:20px"><button aria-label="Help player ${i + 1}">${icons.help('#D9FFF7')}</button><button aria-label="Pass player ${i + 1}">${icons.pass('#D9FFF7')}</button></div>
${pill.replace('class="c-pill', `style="${side}:26px" class="c-pill`)}
</section>`;
}

function shell(size) {
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><path d="M24 6 C 8 10 4 26 8 38 H40 C44 26 40 10 24 6Z" fill="#FFB38A"/><path d="M24 8 V38 M16 11 L13 38 M32 11 L35 38" stroke="#E07F63" stroke-width="3" stroke-linecap="round"/><rect x="10" y="37" width="28" height="6" rx="3" fill="#E07F63"/></svg>`;
}

export function game() {
  const body = `<div class="c-root" style="width:1280px;height:720px">
${scenery(11)}
<div class="c-pearl">7</div>
<header class="c-hud">
<div class="c-logo">${shell(46)}<div><b>Number Crew</b><small>Glow Reef</small></div></div>
<div class="c-zone"><p>Coral Garden</p><div><i class="done"></i><i class="now"></i><i></i></div></div>
<button class="c-pause" aria-label="Pause game (teacher)">${icons.pause('#fff')}</button>
</header>
${station(0, 36, 88, { kind: 'count', n: 4, choices: [4, 3], correct: 0, state: 'done', mood: 'cheer' })}
${station(1, 656, 88, { kind: 'add', a: 2, b: 3, choices: [6, 5], correct: 1, state: 'wait', mood: 'happy' })}
${station(2, 36, 356, { kind: 'count', n: 3, choices: [2, 3], correct: 1, tried: 0, state: 'help', mood: 'think' })}
${station(3, 656, 356, { kind: 'add', a: 4, b: 1, choices: [5, 4], correct: 0, state: 'wait', mood: 'happy' })}
<div class="c-swim">${fish(44)}</div>
</div>`;
  return { title: 'C · Glow Reef — play', fonts, css, body, w: 1280, h: 720 };
}

function mini(n) {
  const box = (x, y, w, h, c) => `<i style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--c:${c}"></i>`;
  const cs = P.map(p => p.c);
  const L = {
    1: box(16, 7, 76, 40, cs[0]),
    2: box(6, 7, 46, 40, cs[0]) + box(56, 7, 46, 40, cs[1]),
    3: box(6, 5, 46, 21, cs[0]) + box(56, 5, 46, 21, cs[1]) + box(31, 29, 46, 21, cs[2]),
    4: box(6, 5, 46, 21, cs[0]) + box(56, 5, 46, 21, cs[1]) + box(6, 29, 46, 21, cs[2]) + box(56, 29, 46, 21, cs[3]),
  };
  return `<figure><div class="c-mini">${L[n]}<b></b></div><figcaption>${n} ${n === 1 ? 'player' : 'players'}</figcaption></figure>`;
}

export function kit() {
  const states = [['Ready', 'c-live', ''], ['Pressed', '', 'transform:scale(.94);box-shadow:0 0 0 6px var(--c),0 4px 10px rgba(3,25,40,.45),inset 0 6px 14px rgba(110,150,180,.45);'], ['Right answer', '', 'is-right'], ['Try again', '', 'is-try']];
  const body = `<div class="c-root c-kit" style="width:1280px;height:720px">
${scenery(23, false)}
<div style="position:absolute;left:56px;top:44px;width:620px;display:flex;flex-direction:column;gap:30px">
<div class="c-logo">${shell(76)}<div><b style="font-size:56px">Number Crew</b><small style="font-size:24px">Glow Reef</small></div></div>
<div><h2>The crew</h2><div class="row" style="gap:12px">${P.map((p, i) => `<figure>${creature(i, i === 0 ? 'cheer' : i === 2 ? 'think' : 'happy', 128)}<figcaption>${marker(i, p.c, 20)}${p.name}</figcaption></figure>`).join('')}</div></div>
<div><h2>Answer buttons</h2><div class="row" style="gap:46px;padding-left:12px">${states.map(([label, wrap, v], k) => `<figure class="${wrap} c-p${k === 2 ? 0 : 1}" style="gap:22px"><button class="c-btn ${v.startsWith('is-') ? v : ''}" style="${v.startsWith('is-') ? '' : v}" aria-label="${label} example"><span>${k === 2 ? 4 : 3}</span></button><figcaption>${label}</figcaption></figure>`).join('')}</div></div>
</div>
<div style="position:absolute;left:720px;top:52px;width:520px;display:flex;flex-direction:column;gap:30px">
<div><h2>Colour</h2><div class="row" style="gap:10px">${[['#176F88', 'Reef water'], ['#FFE27A', 'Lantern'], ['#FF8A7A', 'Coral'], ['#FFD166', 'Sunshine'], ['#62E3B4', 'Seafoam'], ['#C7A8FF', 'Lavender']].map(([h, n]) => `<div class="c-sw"><i style="background:${h}"></i>${n}<small>${h}</small></div>`).join('')}</div></div>
<div><h2>Numbers · Fredoka</h2><div class="c-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<span>${n}</span>`).join('')}</div></div>
<div><h2>Things to count</h2><div class="row" style="gap:24px;align-items:center">${fish(70)}<span style="display:flex;gap:2px">${fish(46)}${fish(46)}${fish(46)}</span><span class="c-plus" style="margin:0">+</span><span style="display:flex;gap:2px">${fish(46)}${fish(46)}</span></div></div>
<div><h2>One to four players</h2><div class="row" style="gap:14px">${[1, 2, 3, 4].map(mini).join('')}</div></div>
<p class="c-note">Feels like: a quiet aquarium. Light drifts, bubbles rise slowly, each right answer sends a glowing fish home to light up the reef. Sound: soft marimba, bubbles and a gentle whale song.</p>
</div>
</div>`;
  return { title: 'C · Glow Reef — kit', fonts, css, body, w: 1280, h: 720 };
}
