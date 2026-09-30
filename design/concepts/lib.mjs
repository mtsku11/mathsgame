// Shared SVG helpers for the three design directions.
export const f = n => +n.toFixed(1);

export function starPath(cx, cy, ro, ri, n = 5, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = (rot + (i * 180) / n) * Math.PI / 180;
    d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
  }
  return d + 'Z';
}

export function gearPath(cx, cy, ro, ri, teeth = 8) {
  const p = (Math.PI * 2) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    const pts = [[ri, a], [ro, a + 0.14 * p], [ro, a + 0.4 * p], [ri, a + 0.54 * p]];
    for (const [r, t] of pts) d += (d ? 'L' : 'M') + f(cx + r * Math.cos(t)) + ' ' + f(cy + r * Math.sin(t));
  }
  return d + 'Z';
}

export function hexPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
  }
  return d + 'Z';
}

// Player shape markers (circle, triangle, square, diamond) in a 24 box.
export const markerShapes = [
  '<circle cx="12" cy="12" r="9"/>',
  '<path d="M12 2.5 22 20.5H2Z" stroke-linejoin="round"/>',
  '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  '<path d="m12 1.5 10.5 10.5L12 22.5 1.5 12Z" stroke-linejoin="round"/>',
];
export const markerNames = ['Circle', 'Triangle', 'Square', 'Diamond'];
export function marker(i, color, size = 24, stroke = '') {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g fill="${color}" ${stroke ? `stroke="${stroke}" stroke-width="2"` : ''}>${markerShapes[i]}</g></svg>`;
}

export function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

// Convert self-closing tags to explicit pairs so the canvas runtime parses them.
export function expand(html) {
  return html.replace(/<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*\/>/g, (m, tag, attrs) =>
    ['br', 'img', 'input', 'meta', 'link', 'hr'].includes(tag.toLowerCase()) ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`);
}

export const icons = {
  pause: c => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.6" fill="${c}"/><rect x="14" y="4" width="5" height="16" rx="1.6" fill="${c}"/></svg>`,
  help: c => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/></svg>`,
  pass: c => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 6 6 6-6 6M13 6l6 6-6 6"/></svg>`,
  chevL: c => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>`,
  chevR: c => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>`,
};

// Board wrappers --------------------------------------------------------
export function dcBoard({ title, fonts, css, body, w, h }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>
</helmet>
${expand(body)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

export function previewPage({ title, fonts, css, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${fonts}"><style>${css}</style></head><body>${expand(body)}</body></html>`;
}
