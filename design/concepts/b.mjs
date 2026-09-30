// Direction B — Bot Builders: chunky daylight toy workshop, thick outlines.
import { gearPath, hexPath, marker, icons, f } from './lib.mjs';

const fonts = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Rubik:wght@500;700;800&display=swap';
const ink = '#1E2440';
const led = '#8FF7FF';
const P = [
  { c: '#FF5A4E', l: '#FFB0A8', name: 'Red bot' },
  { c: '#2F7BFF', l: '#A9C8FF', name: 'Blue bot' },
  { c: '#FFC526', l: '#FFE7A0', name: 'Yellow bot' },
  { c: '#1FBF84', l: '#A6EBCF', name: 'Green bot' },
];

export function robot(i, mood = 'happy', w = 120) {
  const { c, l } = P[i];
  let face;
  if (mood === 'cheer') face = `<path d="M36 62 Q44 48 52 62" stroke="${led}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M68 62 Q76 48 84 62" stroke="${led}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M47 70 Q60 86 73 70 Z" fill="${led}"/>`;
  else if (mood === 'think') face = `<rect x="44" y="47" width="12" height="15" rx="6" fill="${led}"/><rect x="74" y="47" width="12" height="15" rx="6" fill="${led}"/><circle cx="52" cy="77" r="3" fill="${led}"/><circle cx="61" cy="77" r="3" fill="${led}"/><circle cx="70" cy="77" r="3" fill="${led}"/>`;
  else face = `<rect x="38" y="49" width="13" height="18" rx="6.5" fill="${led}"/><rect x="69" y="49" width="13" height="18" rx="6.5" fill="${led}"/><path d="M50 76 Q60 83 70 76" stroke="${led}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 120 112" width="${w}" height="${f(w * 112 / 120)}" aria-hidden="true">
<path d="M60 26 V12" stroke="${ink}" stroke-width="5"/><circle cx="60" cy="10" r="8" fill="${l}" stroke="${ink}" stroke-width="4"/>
<rect x="3" y="46" width="14" height="30" rx="5" fill="#A9B8CF" stroke="${ink}" stroke-width="4"/><rect x="103" y="46" width="14" height="30" rx="5" fill="#A9B8CF" stroke="${ink}" stroke-width="4"/>
<rect x="13" y="24" width="94" height="82" rx="24" fill="${c}" stroke="${ink}" stroke-width="5"/>
<path d="M26 34 Q34 29 46 29" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>
<rect x="25" y="37" width="70" height="56" rx="14" fill="${ink}"/>
<g class="b-face">${face}</g>
<circle cx="22" cy="97" r="3.5" fill="${ink}" opacity=".35"/><circle cx="98" cy="97" r="3.5" fill="${ink}" opacity=".35"/>
</svg>`;
}

export function cog(size = 54, fill = '#FFB020') {
  return `<svg class="b-cog" viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true"><path d="${gearPath(30, 30, 27, 20, 8)}" fill="${fill}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="30" cy="30" r="12" fill="#FFD66B" stroke="${ink}" stroke-width="3"/><circle cx="30" cy="30" r="5" fill="${ink}"/></svg>`;
}

function bigBot() {
  const dash = `fill="#fff" fill-opacity=".45" stroke="${ink}" stroke-opacity=".45" stroke-width="3" stroke-dasharray="7 6"`;
  return `<svg viewBox="0 0 300 172" width="300" height="172" aria-hidden="true">
<rect x="18" y="4" width="12" height="166" rx="3" fill="#7C8DA8" stroke="${ink}" stroke-width="3"/><rect x="270" y="4" width="12" height="166" rx="3" fill="#7C8DA8" stroke="${ink}" stroke-width="3"/>
<rect x="18" y="4" width="264" height="12" rx="3" fill="#7C8DA8" stroke="${ink}" stroke-width="3"/>
<path d="M30 40 L270 40" stroke="${ink}" stroke-opacity=".18" stroke-width="3"/>
<path d="M150 17 V26" stroke="${ink}" stroke-width="3" stroke-opacity=".45"/>
<circle cx="150" cy="24" r="6" ${dash}/>
<rect x="114" y="30" width="72" height="42" rx="14" ${dash}/>
<rect x="68" y="80" width="24" height="44" rx="9" ${dash}/><rect x="208" y="80" width="24" height="44" rx="9" ${dash}/>
<rect x="96" y="74" width="108" height="56" rx="16" fill="#A9B8CF" stroke="${ink}" stroke-width="4.5"/>
<path d="M106 84 Q116 80 132 80" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" fill="none"/>
<g transform="translate(103 90)"><path d="${gearPath(12, 12, 11, 8, 8)}" fill="#FF5A4E" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="${ink}"/></g>
<circle cx="140" cy="102" r="10" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-dasharray="4 4"/><circle cx="165" cy="102" r="10" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-dasharray="4 4"/><circle cx="190" cy="102" r="10" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-dasharray="4 4"/>
<rect x="112" y="128" width="24" height="26" fill="#7C8DA8" stroke="${ink}" stroke-width="4"/><rect x="164" y="128" width="24" height="26" fill="#7C8DA8" stroke="${ink}" stroke-width="4"/>
<rect x="102" y="150" width="42" height="20" rx="8" fill="#A9B8CF" stroke="${ink}" stroke-width="4"/><rect x="156" y="150" width="42" height="20" rx="8" fill="#A9B8CF" stroke="${ink}" stroke-width="4"/>
<g class="b-spark"><path d="M98 80 l4 -9 l4 9 l-4 9z" fill="#FFC526" stroke="${ink}" stroke-width="2"/><path d="M84 100 l3 -6 l3 6 l-3 6z" fill="#fff" stroke="${ink}" stroke-width="2"/></g>
</svg>`;
}

function nuts(done, current) {
  return Array.from({ length: 6 }, (_, i) => {
    const fill = i < done ? '#FFB020' : '#fff';
    const cls = i === current ? 'class="b-blink"' : '';
    const op = i > current ? 'stroke-opacity=".35"' : '';
    return `<svg ${cls} viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><path d="${hexPath(15, 15, 12.5)}" fill="${fill}" stroke="${ink}" stroke-width="3" stroke-linejoin="round" ${op}/><circle cx="15" cy="15" r="4.5" fill="${i < done ? ink : 'none'}" stroke="${ink}" stroke-width="2.5" ${op}/></svg>`;
  }).join('');
}

const css = `
body{margin:0}
*{box-sizing:border-box}
.b-root{position:relative;width:1280px;height:720px;overflow:hidden;font-family:Rubik,system-ui,sans-serif;color:${ink};background-color:#BFE4FF;background-image:radial-gradient(circle,#A3D2F4 3.2px,transparent 3.8px);background-size:30px 30px;background-position:6px 6px}
.b-root::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 40%);pointer-events:none}
.b-logo{position:absolute;left:26px;top:22px;transform:rotate(-3deg);background:#FFC526;border:4px solid ${ink};border-radius:16px;box-shadow:0 6px 0 ${ink};padding:8px 18px 10px}
.b-logo b{display:block;font-family:'Lilita One';font-weight:400;font-size:32px;line-height:1}
.b-logo small{display:block;font-weight:800;font-size:15px;line-height:1.2}
.b-prog{position:absolute;right:98px;top:24px;background:#fff;border:4px solid ${ink};border-radius:16px;box-shadow:0 6px 0 ${ink};padding:8px 14px;display:flex;align-items:center;gap:6px;font-weight:800;font-size:17px}
.b-prog span{margin-right:6px}
.b-pause{position:absolute;right:26px;top:24px;width:58px;height:58px;border-radius:16px;background:#fff;border:4px solid ${ink};box-shadow:0 6px 0 ${ink};display:grid;place-items:center;cursor:pointer;padding:0}
.b-blink{animation:b-blink 1.2s ease-in-out infinite}
@keyframes b-blink{50%{transform:scale(1.18)}}
.b-bot{position:absolute;left:490px;top:0}
.b-spark{animation:b-flash .9s steps(2) infinite}
@keyframes b-flash{50%{opacity:0}}
.b-belt{position:absolute;left:-10px;right:-10px;top:170px;height:26px;background:repeating-linear-gradient(90deg,#3A4468 0 16px,#2A3252 16px 32px);border-top:4px solid ${ink};border-bottom:4px solid ${ink};animation:b-belt 1s linear infinite}
@keyframes b-belt{to{background-position:32px 0}}
.b-card{position:absolute;top:252px;width:296px;height:456px;background:#fff;border:5px solid ${ink};border-radius:28px;box-shadow:0 9px 0 ${ink}}
.b-p0{--c:#FF5A4E}.b-p1{--c:#2F7BFF}.b-p2{--c:#FFC526}.b-p3{--c:#1FBF84}
.b-head{position:absolute;left:-5px;right:-5px;top:-5px;height:76px;background:var(--c);border:5px solid ${ink};border-radius:28px 28px 0 0}
.b-head::after{content:'';position:absolute;left:0;right:0;bottom:-5px;height:5px;background:${ink}}
.b-shape{position:absolute;left:16px;top:20px}
.b-robot{position:absolute;left:50%;margin-left:-60px;top:-58px;transform-origin:50% 100%;animation:b-tilt 3s ease-in-out infinite}
.b-p1 .b-robot{animation-delay:-.7s}.b-p2 .b-robot{animation-delay:-1.4s}.b-p3 .b-robot{animation-delay:-2.1s}
.b-card.is-done .b-robot{animation:b-jump .8s ease-in-out infinite}
@keyframes b-tilt{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes b-jump{0%,100%{transform:translateY(0)}35%{transform:translateY(-16px) rotate(-5deg)}70%{transform:translateY(0) scaleY(.94)}}
.b-face{animation:b-eyes 4s infinite;transform-origin:60px 60px}
@keyframes b-eyes{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
.b-q{position:absolute;left:0;right:0;top:82px;height:150px;display:flex;flex-direction:column;align-items:center;gap:8px}
.b-prompt{margin:0;font-weight:800;font-size:26px;line-height:42px}
.b-eq{margin:0;font-family:'Lilita One';font-size:44px;line-height:42px;letter-spacing:1px}
.b-objs{display:flex;align-items:center;gap:8px;height:92px}
.b-grp{display:flex;gap:3px}
.b-plus{font-family:'Lilita One';font-size:34px;margin:0 4px}
.b-count{display:flex;flex-direction:column;align-items:center}
.b-count i{font-style:normal;font-family:'Lilita One';font-size:18px;width:28px;height:28px;border-radius:50%;background:${ink};color:#fff;display:grid;place-items:center;margin-top:-4px}
.b-ans{position:absolute;left:16px;right:16px;top:244px;display:flex;gap:16px}
.b-btn{position:relative;flex:1;height:120px;border-radius:28px;border:5px solid ${ink};background:var(--c);box-shadow:0 10px 0 ${ink};cursor:pointer;padding:0;font-family:'Lilita One';font-size:82px;line-height:1;color:#fff;text-shadow:0 5px 0 ${ink},3px 3px 0 ${ink},-3px 3px 0 ${ink},3px -3px 0 ${ink},-3px -3px 0 ${ink},0 3px 0 ${ink},0 -3px 0 ${ink},3px 0 0 ${ink},-3px 0 0 ${ink}}
.b-btn::before{content:'';position:absolute;left:14px;right:14px;top:9px;height:26px;border-radius:14px;background:rgba(255,255,255,.35)}
.b-btn{display:grid;place-items:center}
.b-btn .b-num{position:relative}
.b-live .b-btn{animation:b-idle 2.4s ease-in-out infinite}
.b-live .b-btn+.b-btn{animation-delay:.3s}
@keyframes b-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.b-btn.is-right{animation:b-pop 1.6s ease-in-out infinite}
@keyframes b-pop{0%,100%{transform:scale(1)}14%{transform:scale(1.1) rotate(-3deg)}28%{transform:scale(.96)}40%{transform:scale(1.02)}}
.b-btn.is-dim{background:#DDE3EC;color:#fff;box-shadow:0 10px 0 #9AA6BD;border-color:#9AA6BD;text-shadow:0 5px 0 #9AA6BD,3px 3px 0 #9AA6BD,-3px 3px 0 #9AA6BD,3px -3px 0 #9AA6BD,-3px -3px 0 #9AA6BD}
.b-btn.is-try{animation:b-squish 2.6s ease-in-out infinite;transform-origin:50% 100%}
@keyframes b-squish{0%,70%,100%{transform:scale(1,1)}76%{transform:scale(1.08,.86)}84%{transform:scale(.95,1.06)}92%{transform:scale(1.02,.98)}}
.b-tick{position:absolute;right:-12px;top:-14px;width:40px;height:40px;border-radius:50%;background:#fff;border:4px solid ${ink};display:grid;place-items:center}
.b-rays{position:absolute;left:50%;top:50%;width:176px;height:176px;margin:-88px 0 0 -88px;background:repeating-conic-gradient(rgba(255,197,38,.55) 0 12deg,transparent 12deg 30deg);border-radius:50%;animation:b-spin 6s linear infinite;-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%)}
@keyframes b-spin{to{transform:rotate(360deg)}}
.b-foot{position:absolute;left:16px;right:16px;bottom:14px;height:46px;display:flex;align-items:center;justify-content:space-between}
.b-status{margin:0;font-weight:800;font-size:18px;display:flex;align-items:center;gap:8px}
.b-teach{display:flex;gap:8px}
.b-teach button{width:44px;height:44px;border-radius:14px;border:3px solid #C9D2E0;background:#F4F7FB;display:grid;place-items:center;cursor:pointer;padding:0}
.b-fly{position:absolute;left:0;top:0;offset-path:path('M172 152 L 560 152 Q 600 152 604 102');offset-rotate:0deg;animation:b-fly 3s cubic-bezier(.5,0,.4,1) infinite}
@keyframes b-fly{0%{offset-distance:0%;opacity:0}6%{opacity:1}80%{offset-distance:88%}94%{offset-distance:100%;opacity:1}100%{offset-distance:100%;opacity:0}}
.b-fly svg{animation:b-spin 1.2s linear infinite}
/* kit */
.b-kit h2{margin:0 0 10px;font-size:18px;font-weight:800;line-height:1}
.b-kit .row{display:flex;gap:18px;align-items:flex-end}
.b-kit figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:10px}
.b-kit figcaption{font-size:16px;font-weight:700;display:flex;align-items:center;gap:6px}
.b-sw{width:78px;display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:700;line-height:1.1}
.b-sw i{display:block;width:78px;height:42px;border-radius:16px;border:4px solid ${ink};box-shadow:0 5px 0 ${ink}}
.b-sw small{font-weight:500}
.b-nums{font-family:'Lilita One';font-size:48px;line-height:1;display:flex;gap:15px}
.b-mini{width:112px;height:63px;border-radius:10px;background:#BFE4FF;border:3px solid ${ink};position:relative;overflow:hidden}
.b-mini i{position:absolute;border-radius:5px;border:2px solid ${ink};background:#fff;border-top:9px solid var(--c)}
.b-mini b{position:absolute;left:0;right:0;top:16px;height:4px;background:${ink}}
.b-mini em{position:absolute;left:50%;top:3px;width:14px;height:13px;margin-left:-7px;border-radius:3px;background:#A9B8CF;border:2px solid ${ink}}
.b-note{font-size:16px;font-weight:500;line-height:1.45;margin:0;max-width:560px}
.b-panel{background:#fff;border:5px solid ${ink};border-radius:28px;box-shadow:0 9px 0 ${ink};padding:16px 24px}
`;

function card(i, left, q) {
  const { mood, state } = q;
  const objs = q.kind === 'count'
    ? `<p class="b-prompt">How many?</p><div class="b-objs">${Array.from({ length: q.n }, (_, k) => state === 'help' ? `<span class="b-count">${cog(56)}<i>${k + 1}</i></span>` : cog(58)).join('')}</div>`
    : `<p class="b-eq">${q.a} + ${q.b} = ?</p><div class="b-objs"><span class="b-grp">${Array.from({ length: q.a }, () => cog(40)).join('')}</span><span class="b-plus">+</span><span class="b-grp">${Array.from({ length: q.b }, () => cog(40)).join('')}</span></div>`;
  const btn = side => {
    const cls = state === 'done' ? (side === q.correct ? 'is-right' : 'is-dim') : state === 'help' && side === q.tried ? 'is-try' : '';
    const extra = cls === 'is-right' ? `<span class="b-rays"></span>` : '';
    const tick = cls === 'is-right' ? `<span class="b-tick"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : '';
    return `<button class="b-btn ${cls}" aria-label="Player ${i + 1} ${side ? 'right' : 'left'} answer, ${q.choices[side]}">${extra}<span class="b-num">${q.choices[side]}</span>${tick}</button>`;
  };
  const status = state === 'done' ? 'Part sent!' : state === 'help' ? 'Count again' : 'Your turn';
  return `<section class="b-card b-p${i} ${state === 'done' ? 'is-done' : ''} ${state === 'wait' ? 'b-live' : ''}" style="left:${left}px" aria-label="Player ${i + 1}">
<div class="b-head"><span class="b-shape">${marker(i, '#fff', 28, ink)}</span></div>
<div class="b-robot">${robot(i, mood)}</div>
<div class="b-q">${objs}</div>
<div class="b-ans">${btn(0)}${btn(1)}</div>
<div class="b-foot"><p class="b-status">${status}</p><div class="b-teach"><button aria-label="Help player ${i + 1}">${icons.help('#6B7896')}</button><button aria-label="Pass player ${i + 1}">${icons.pass('#6B7896')}</button></div></div>
</section>`;
}

export function game() {
  const body = `<div class="b-root" style="width:1280px;height:720px">
<div class="b-logo"><b>Number Crew</b><small>Bot Builders</small></div>
<div class="b-prog"><span>Round 3</span>${nuts(2, 2)}</div>
<button class="b-pause" aria-label="Pause game (teacher)">${icons.pause(ink)}</button>
<div class="b-bot">${bigBot()}</div>
<div class="b-belt"></div>
${card(0, 24, { kind: 'count', n: 4, choices: [4, 3], correct: 0, state: 'done', mood: 'cheer' })}
${card(1, 336, { kind: 'add', a: 2, b: 3, choices: [6, 5], correct: 1, state: 'wait', mood: 'happy' })}
${card(2, 648, { kind: 'count', n: 3, choices: [2, 3], correct: 1, tried: 0, state: 'help', mood: 'think' })}
${card(3, 960, { kind: 'add', a: 4, b: 1, choices: [5, 4], correct: 0, state: 'wait', mood: 'happy' })}
<div class="b-fly">${cog(34, '#FF5A4E')}</div>
</div>`;
  return { title: 'B · Bot Builders — play', fonts, css, body, w: 1280, h: 720 };
}

function mini(n) {
  const w = n === 1 ? 60 : n === 2 ? 44 : n === 3 ? 30 : 23;
  const gap = 4;
  const total = n * w + (n - 1) * gap;
  const x0 = (112 - 6 - total) / 2;
  const cards = Array.from({ length: n }, (_, k) => `<i style="left:${f(x0 + k * (w + gap))}px;top:24px;width:${w}px;height:30px;--c:${P[k].c}"></i>`).join('');
  return `<figure><div class="b-mini"><em></em><b></b>${cards}</div><figcaption>${n} ${n === 1 ? 'player' : 'players'}</figcaption></figure>`;
}

export function kit() {
  const states = [
    ['Ready', 'b-live', '', ''],
    ['Pressed', '', '', 'transform:translateY(8px);box-shadow:0 2px 0 #1E2440;'],
    ['Right answer', '', 'is-right', ''],
    ['Try again', '', 'is-try', ''],
  ];
  const body = `<div class="b-root b-kit" style="width:1280px;height:720px">
<div style="position:absolute;left:48px;top:40px;width:620px;display:flex;flex-direction:column;gap:26px">
<div class="b-logo" style="position:relative;left:0;top:0;align-self:flex-start;padding:12px 26px 14px"><b style="font-size:54px">Number Crew</b><small style="font-size:22px">Bot Builders</small></div>
<div class="b-panel"><h2>The crew</h2><div class="row" style="gap:22px">${P.map((p, i) => `<figure>${robot(i, i === 0 ? 'cheer' : i === 2 ? 'think' : 'happy', 104)}<figcaption>${marker(i, p.c, 20, ink)}${p.name}</figcaption></figure>`).join('')}</div></div>
<div class="b-panel"><h2>Answer buttons</h2><div class="row" style="gap:22px">${states.map(([label, wrap, cls, style], k) => `<figure class="${wrap} b-p${k === 2 ? 0 : 1}" style="width:118px"><button class="b-btn ${cls}" style="${style}width:118px;flex:none" aria-label="${label} example">${cls === 'is-right' ? '<span class="b-rays"></span>' : ''}<span class="b-num">${k === 2 ? 4 : 3}</span></button><figcaption>${label}</figcaption></figure>`).join('')}</div></div>
</div>
<div style="position:absolute;left:712px;top:34px;width:524px;display:flex;flex-direction:column;gap:16px">
<div class="b-panel"><h2>Colour</h2><div class="row" style="gap:8px">${[['#BFE4FF', 'Pegboard'], ['#1E2440', 'Outline'], ['#FF5A4E', 'Red'], ['#2F7BFF', 'Blue'], ['#FFC526', 'Yellow'], ['#1FBF84', 'Green']].map(([h, n]) => `<div class="b-sw" style="width:70px"><i style="background:${h};width:66px"></i>${n}<small>${h}</small></div>`).join('')}</div></div>
<div class="b-panel" style="padding:14px 24px"><h2>Numbers · Lilita One</h2><div class="b-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<span>${n}</span>`).join('')}</div></div>
<div class="b-panel" style="padding:14px 24px"><h2>Things to count</h2><div class="row" style="gap:22px;align-items:center">${cog(62)}<span style="display:flex;gap:3px">${cog(42)}${cog(42)}${cog(42)}</span><span class="b-plus" style="margin:0">+</span><span style="display:flex;gap:3px">${cog(42)}${cog(42)}</span></div></div>
<div class="b-panel" style="padding:14px 24px"><h2>One to four players</h2><div class="row" style="gap:12px">${[1, 2, 3, 4].map(mini).join('')}</div></div>
<p class="b-note">Feels like: a bright toy workshop. Buttons squash when pressed, robots bounce, each right answer sends a cog along the belt to build Big Bot. Sound: boings, clunks and a toy xylophone.</p>
</div>
</div>`;
  return { title: 'B · Bot Builders — kit', fonts, css, body, w: 1280, h: 720 };
}
