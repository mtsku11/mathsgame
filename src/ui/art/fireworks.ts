import { starPath } from './stars';

const f = (n: number): number => +n.toFixed(1);
const dot = (x: number, y: number, r: number, fill: string, opacity = 1): string => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${opacity < 1 ? ` opacity="${f(opacity)}"` : ''}/>`;

// Vertices of a five-point star, outer and inner radius alternating, first point straight up.
export function starOutline(radius: number, inner: number): { x: number; y: number }[] {
  return Array.from({ length: 10 }, (_, j) => {
    const angle = (-90 + j * 36) * Math.PI / 180, r = j % 2 ? radius * inner : radius;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}
// A point at `t` (0..1) along the star's outline.
export function starPoint(t: number, radius: number, inner: number): { x: number; y: number } {
  const corners = starOutline(radius, inner), s = ((t % 1) + 1) % 1 * 10, k = Math.floor(s), u = s - k;
  const a = corners[k % 10], b = corners[(k + 1) % 10];
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

// Static firework bursts for calm modes, drawn as dots on a 200x200 box centred on 0,0. Coloured dots use currentColor, so one symbol serves every pilot.
const outline = (radius: number, inner: number): string => Array.from({ length: 40 }, (_, i) => { const p = starPoint(i / 40, radius, inner); return dot(p.x, p.y, 3.4, 'currentColor'); }).join('');
const peony = (): string => Array.from({ length: 14 }, (_, i) => Array.from({ length: 5 }, (__, k) => {
  const a = (i / 14) * Math.PI * 2 + (k % 2) * 0.05, d = 92 * ((k + 1) / 5);
  return dot(Math.cos(a) * d, Math.sin(a) * d, 1.6 + (4 - k) * 0.85, k > 3 ? '#fff' : 'currentColor', 1 - k * 0.08);
}).join('')).join('');
const ring = (): string => Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2; return dot(Math.cos(a) * 90, Math.sin(a) * 90, 3.6, 'currentColor'); }).join('') +
  Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return dot(Math.cos(a) * 52, Math.sin(a) * 52, 2.6, '#fff', 0.85); }).join('');
const face = (): string => outline(94, 0.56) +
  dot(-26, -12, 9, '#fff') + dot(26, -12, 9, '#fff') +
  Array.from({ length: 14 }, (_, i) => { const t = i / 13, u = 1 - t; return dot(u * u * -38 + 2 * u * t * 0 + t * t * 38, u * u * 14 + 2 * u * t * 62 + t * t * 14, 4.2, '#fff'); }).join('');

export function fireworkSymbols(): string {
  const symbol = (id: string, body: string): string => `<symbol id="sp-fw-${id}" viewBox="-100 -100 200 200" overflow="visible">${body}<circle r="9" fill="#fff" opacity=".9"/></symbol>`;
  return `<defs>${symbol('star', outline(92, 0.45))}${symbol('peony', peony())}${symbol('ring', ring())}<symbol id="sp-fw-face" viewBox="-100 -100 200 200" overflow="visible">${face()}</symbol></defs>`;
}

// Golden glitter for the calm finale: a fixed scatter across the sky.
export function glitterField(count = 70): string {
  let seed = 7;
  const random = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: count }, () => dot(random() * 1280, 30 + random() * 560, 1.6 + random() * 3.2, random() < 0.3 ? '#FFF6C9' : '#FFD23F', 0.55 + random() * 0.45)).join('');
}
export const smallStar = (cx: number, cy: number, r: number, fill: string): string => `<path d="${starPath(cx, cy, r, r * 0.42)}" fill="${fill}" stroke="${fill}" stroke-width="${f(r * 0.18)}" stroke-linejoin="round"/>`;

export type HorizonKind = 'ring' | 'candy' | 'ice';
const surfaces: Record<HorizonKind, { ground: string; rim: string; crater: string; glow: string }> = {
  ring: { ground: '#E08A1E', rim: '#FFD23F', crater: '#C46F10', glow: 'rgba(255,190,90,.35)' },
  candy: { ground: '#E5539F', rim: '#FFC2DF', crater: '#C23A85', glow: 'rgba(255,170,215,.35)' },
  ice: { ground: '#6EA9F2', rim: '#E8F5FF', crater: '#4F8BDB', glow: 'rgba(170,215,255,.35)' },
};
// The planet the crew is over, seen as a curved horizon along the bottom of the stage with a soft rim of light above it.
export function horizon(kind: HorizonKind): string {
  const c = surfaces[kind];
  return `<svg class="sp-fw-horizon" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
<defs><linearGradient id="sp-fw-rim" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c.glow}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient></defs>
<path d="M0 650 Q640 560 1280 650 L1280 500 Q640 410 0 500Z" fill="url(#sp-fw-rim)"/>
<path d="M0 720 L0 650 Q640 560 1280 650 L1280 720Z" fill="${c.ground}"/>
<path d="M0 660 Q640 572 1280 660" stroke="${c.rim}" stroke-width="6" fill="none" opacity=".6"/>
<ellipse cx="250" cy="690" rx="70" ry="9" fill="${c.crater}" opacity=".55"/><ellipse cx="640" cy="668" rx="90" ry="10" fill="${c.crater}" opacity=".45"/><ellipse cx="1030" cy="694" rx="80" ry="9" fill="${c.crater}" opacity=".55"/>
</svg>`;
}
