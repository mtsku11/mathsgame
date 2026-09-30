// Switch-cap colours: the answer button, the check-in cap and the switch-setup slot can match the colour of the physical switch.
// Every entry carries the ink (numeral, picture, chevron) that reads on it; tests hold every shade the button shows to WCAG AA.
export const capIds = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'black'] as const;
export type CapColour = 'pilot' | typeof capIds[number];
export interface CapSpec { id: typeof capIds[number]; name: string; fill: string; ink: string; gloss: number }

const light = '#FFFFFF', dark = '#1A1446';
export const caps: readonly CapSpec[] = [
  { id: 'red', name: 'Red', fill: '#C62828', ink: light, gloss: 0.06 },
  { id: 'orange', name: 'Orange', fill: '#FF8A1F', ink: dark, gloss: 0.3 },
  { id: 'yellow', name: 'Yellow', fill: '#FFD23F', ink: dark, gloss: 0.3 },
  { id: 'green', name: 'Green', fill: '#3CC96A', ink: dark, gloss: 0.3 },
  { id: 'blue', name: 'Blue', fill: '#1A56D0', ink: light, gloss: 0.06 },
  { id: 'purple', name: 'Purple', fill: '#6E33D6', ink: light, gloss: 0.06 },
  { id: 'white', name: 'White', fill: '#F4F1FF', ink: dark, gloss: 0.3 },
  { id: 'black', name: 'Black', fill: '#1B1B2B', ink: light, gloss: 0.06 },
];

type Rgb = [number, number, number];
const parse = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const format = (rgb: Rgb): string => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a: Rgb, b: Rgb, amount: number): Rgb => a.map((v, i) => v * (1 - amount) + b[i] * amount) as Rgb;
function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The four backgrounds the ink can sit on: the gradient's centre, lightest and darkest stops, and the gloss over the lightest.
export function capShades(spec: CapSpec): { fill: string; light: string; dark: string; gloss: string } {
  const fill = parse(spec.fill), brightest = mix(fill, [255, 255, 255], 0.08);
  return { fill: spec.fill, light: format(brightest), dark: format(mix(fill, [0, 0, 0], 0.12)), gloss: format(mix(brightest, [255, 255, 255], spec.gloss)) };
}

export const capSpec = (id: CapColour): CapSpec | null => caps.find(spec => spec.id === id) ?? null;
export function capVars(id: CapColour): Record<string, string> | null {
  const spec = capSpec(id);
  if (!spec) return null;
  const shades = capShades(spec);
  return { '--cap': shades.fill, '--cap-light': shades.light, '--cap-dark': shades.dark, '--cap-ink': spec.ink, '--cap-gloss': String(spec.gloss) };
}
// Applies (or clears) a cap colour on an element as CSS variables; the class lets stylesheets tell a capped control from a pilot-coloured one.
export function paintCap(element: HTMLElement, id: CapColour): void {
  const vars = capVars(id);
  for (const name of ['--cap', '--cap-light', '--cap-dark', '--cap-ink', '--cap-gloss']) {
    if (vars) { if (element.style.getPropertyValue(name) !== vars[name]) element.style.setProperty(name, vars[name]); } else element.style.removeProperty(name);
  }
  element.classList.toggle('has-cap', vars !== null);
}
