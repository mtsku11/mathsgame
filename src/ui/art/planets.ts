export interface Destination { name: string; kind: 'ring' | 'candy' | 'ice'; accent: string }
export const destinations: readonly Destination[] = [
  { name: 'Golden Rings', kind: 'ring', accent: '#FFD48A' },
  { name: 'Candy Planet', kind: 'candy', accent: '#FFC2DF' },
  { name: 'Frosty Moon', kind: 'ice', accent: '#BFE3FF' },
];
export const destinationOf = (round: number): 0 | 1 | 2 => Math.min(2, Math.max(0, Math.floor((round - 1) / 2))) as 0 | 1 | 2;

const bodies: Record<Destination['kind'], string> = {
  ring: '<circle cx="50" cy="50" r="30" fill="#FFB84D"/><path d="M26 44 Q50 36 74 44" stroke="#E08A1E" stroke-width="5" fill="none" opacity=".6"/><path d="M28 58 Q50 52 72 58" stroke="#E08A1E" stroke-width="4" fill="none" opacity=".5"/><ellipse cx="50" cy="52" rx="46" ry="11" fill="none" stroke="#FFE08A" stroke-width="5" transform="rotate(-14 50 52)"/>',
  candy: '<circle cx="50" cy="50" r="34" fill="#FF6FB5"/><circle cx="38" cy="40" r="7" fill="#FF9CCB"/><circle cx="62" cy="60" r="10" fill="#E54C97"/><circle cx="60" cy="34" r="4" fill="#FFC2DF"/><path d="M22 60 Q50 72 78 58" stroke="#FFC2DF" stroke-width="4" fill="none" opacity=".7"/>',
  ice: '<circle cx="50" cy="50" r="30" fill="#4FA8FF"/><path d="M28 40 Q50 30 72 40" stroke="#BFE3FF" stroke-width="6" fill="none" opacity=".8"/><circle cx="60" cy="58" r="6" fill="#2F7FE0"/>',
};
export const planetSvg = (kind: Destination['kind'], size: number): string => `<svg class="sp-planet" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${bodies[kind]}</svg>`;
