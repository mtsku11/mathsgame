import { starPath } from './stars';

// Gloop, the big friendly purple jelly alien of Bubble Blast, and his bubblegum. Ported from design/concepts/boost.mjs; the parts a scene animates carry gl- classes.
// Gloop's mouth is at (150, 210) in his 300x300 box: the bubble grows from there.
export const GLOOP_MOUTH = { x: 150, y: 210 };

export function gloop(size: number): string {
  return `<svg class="sp-gloop" viewBox="0 0 300 300" width="${size}" height="${size}" aria-hidden="true">
<ellipse cx="150" cy="286" rx="110" ry="12" fill="#000" opacity=".25"/>
<g class="gl-body">
<path d="M40 280 C 20 190 50 70 150 64 C 250 70 280 190 260 280 Q 230 292 205 280 Q 180 294 150 281 Q 120 294 95 280 Q 70 292 40 280Z" fill="#9B5CF6"/>
<path d="M62 250 C 50 180 80 96 150 90 C 110 110 88 170 96 250Z" fill="#fff" opacity=".18"/>
<g class="gl-eyes"><circle class="gl-eye" cx="112" cy="140" r="30" fill="#fff"/><circle class="gl-eye" cx="188" cy="140" r="30" fill="#fff"/>
<circle class="gl-pupil" cx="118" cy="146" r="15" fill="#1A1446"/><circle class="gl-pupil" cx="182" cy="146" r="15" fill="#1A1446"/>
<circle cx="123" cy="140" r="5" fill="#fff"/><circle cx="187" cy="140" r="5" fill="#fff"/></g>
<g class="gl-happy" opacity="0"><path d="M82 148 Q112 112 142 148" stroke="#1A1446" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M158 148 Q188 112 218 148" stroke="#1A1446" stroke-width="9" fill="none" stroke-linecap="round"/></g>
<ellipse class="gl-cheek" cx="92" cy="196" rx="16" ry="11" fill="#FF7EC8" opacity=".8"/><ellipse class="gl-cheek" cx="208" cy="196" rx="16" ry="11" fill="#FF7EC8" opacity=".8"/>
<ellipse class="gl-mouth" cx="150" cy="210" rx="16" ry="12" fill="#6B2FC9"/>
<g class="gl-laugh" opacity="0"><path d="M112 198 Q150 262 188 198 Z" fill="#4A1C99"/><path d="M128 228 Q150 214 172 228 Q150 246 128 228Z" fill="#FF7FA8"/></g>
<path d="M150 64 Q 146 34 128 24" stroke="#9B5CF6" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="126" cy="22" r="10" fill="#D6B8FF"/>
</g>
<g class="gl-gum" opacity="0">
<path d="M52 150 C 40 96 92 58 150 58 C 208 58 260 96 248 150 C 236 130 226 138 214 152 C 204 128 190 132 180 150 C 168 118 152 122 146 148 C 134 120 118 126 110 150 C 98 128 76 130 66 156 C 60 152 56 152 52 150Z" fill="#FF7EC8"/>
<path d="M76 92 C 96 70 130 64 150 64" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".6"/>
<path d="M60 200 C 48 200 46 230 56 250 C 66 268 76 250 70 230 C 68 214 66 202 60 200Z" fill="#FF7EC8"/>
<path d="M232 190 C 246 192 252 226 242 246 C 232 264 222 244 226 224 C 228 208 228 194 232 190Z" fill="#E0449C"/>
<ellipse cx="150" cy="262" rx="46" ry="14" fill="#FF9AD5"/><ellipse cx="96" cy="236" rx="16" ry="12" fill="#E0449C"/><ellipse cx="208" cy="240" rx="18" ry="12" fill="#FF7EC8"/>
<circle cx="112" cy="104" r="7" fill="#fff" opacity=".7"/><circle cx="196" cy="108" r="5" fill="#fff" opacity=".55"/>
</g>
</svg>`;
}

// 400x400 box; the circle's bottom edge is at 97.5% of the height, which is the point the bubble grows from.
export const BUBBLE_BASE = 390 / 400;

export function bubble(size: number): string {
  return `<svg class="sp-bubble" viewBox="0 0 400 400" width="${size}" height="${size}" aria-hidden="true">
<defs><radialGradient id="sp-bb-gum" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#FFD1EC"/><stop offset=".55" stop-color="#FF7EC8"/><stop offset="1" stop-color="#E0449C"/></radialGradient></defs>
<circle cx="200" cy="200" r="190" fill="url(#sp-bb-gum)" opacity=".8"/>
<circle cx="200" cy="200" r="188" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="4"/>
<path d="M90 120 A150 150 0 0 1 180 60" stroke="#fff" stroke-width="18" stroke-linecap="round" fill="none" opacity=".75"/>
<circle cx="102" cy="168" r="12" fill="#fff" opacity=".7"/>
<path d="M300 300 A150 150 0 0 1 250 340" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none" opacity=".35"/>
<g class="bb-shine" opacity="0"><path d="M118 96 A130 130 0 0 1 226 52" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M272 248 Q 300 210 296 166" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none" opacity=".8"/>
<path d="${starPath(300, 96, 24, 7, 4)}" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g>
</svg>`;
}

// A flat gum splat (no gradients, so it can sit anywhere): a lumpy blob with flecks, a highlight and a couple of drips. Variants mirror it and change the drips.
export function gumSplat(size: number, colour: string, variant: number): string {
  const drips = [['M34 64 L34 88 Q34 97 41 97 Q48 97 48 88 L48 64Z', 'M60 66 L60 80 Q60 86 65 86 Q70 86 70 80 L70 66Z'], ['M44 66 L44 94 Q44 100 50 100 Q56 100 56 94 L56 66Z', 'M70 62 L70 78 Q70 84 75 84 Q80 84 80 78 L80 62Z'], ['M28 62 L28 82 Q28 88 33 88 Q38 88 38 82 L38 62Z', 'M56 66 L56 92 Q56 99 62 99 Q68 99 68 92 L68 66Z']][variant % 3];
  return `<svg class="sp-splat" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><g fill="${colour}"${variant % 2 ? ' transform="translate(100 0) scale(-1 1)"' : ''}>
<circle cx="50" cy="44" r="28"/><circle cx="20" cy="38" r="12"/><circle cx="80" cy="30" r="13"/><circle cx="76" cy="62" r="13"/><circle cx="26" cy="66" r="11"/><circle cx="52" cy="14" r="9"/>
<circle cx="8" cy="58" r="4"/><circle cx="92" cy="50" r="4"/><circle cx="88" cy="12" r="3.5"/><circle cx="10" cy="14" r="3.5"/><path d="${drips[0]}"/><path d="${drips[1]}"/>
<path d="M30 30 Q40 16 58 18" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".55"/></g></svg>`;
}

// The calm ending: the bubble softly gives way to a small cluster of stars.
export function starCluster(size: number): string {
  const stars = [[200, 200, 46, '#FFD23F'], [120, 150, 26, '#FF7EC8'], [284, 146, 28, '#FFF0A8'], [96, 262, 22, '#FFF0A8'], [300, 262, 24, '#FF7EC8'], [200, 84, 22, '#fff'], [200, 318, 20, '#FFD23F'], [56, 200, 16, '#fff'], [344, 204, 16, '#fff']] as const;
  return `<svg class="sp-bb-cluster" viewBox="0 0 400 400" width="${size}" height="${size}" aria-hidden="true">${stars.map(([x, y, r, fill]) => `<path d="${starPath(x, y, r, r * 0.42)}" fill="${fill}" stroke="${fill}" stroke-width="${(r * 0.18).toFixed(1)}" stroke-linejoin="round"/>`).join('')}</svg>`;
}
