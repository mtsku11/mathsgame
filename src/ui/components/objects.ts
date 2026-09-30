import { goldStar } from '../art/stars';

export type Geo = 1 | 2 | 4;
export interface Zone { w: number; h: number; max: number; gap: number; plus: number }
// Counting-area size per layout in stage pixels; must match .sp-objs in play.css.
export const zones: Record<Geo, Zone> = {
  1: { w: 740, h: 180, max: 112, gap: 12, plus: 64 },
  2: { w: 468, h: 178, max: 88, gap: 8, plus: 44 },
  4: { w: 342, h: 102, max: 60, gap: 4, plus: 28 },
};
export const rowLength = 5;
const badgeRatio = 1.27;

export const geoOf = (players: number): Geo => players === 1 ? 1 : players === 2 ? 2 : 4;

// One size for every star in a question, small enough for the widest row and tallest column including help badges.
export function starSize(groups: number[], zone: Zone): number {
  const columns = groups.map(n => Math.min(n, rowLength));
  const total = columns.reduce((a, b) => a + b, 0);
  const rows = Math.max(...groups.map(n => Math.ceil(n / rowLength)));
  const plus = groups.length > 1 ? zone.plus : 0;
  const byWidth = (zone.w - plus - (total - groups.length) * zone.gap) / total;
  const byHeight = (zone.h - (rows - 1) * zone.gap) / (rows * badgeRatio);
  return Math.floor(Math.min(zone.max, byWidth, byHeight));
}

export function objectsMarkup(groups: number[]): string {
  let number = 0;
  return groups.map(count => `<span class="sp-grp" style="--cols:${Math.min(count, rowLength)}">${Array.from({ length: count }, () => `<span class="sp-obj">${goldStar()}<i class="sp-badge">${++number}</i></span>`).join('')}</span>`)
    .join('<span class="sp-plus" aria-hidden="true">+</span>');
}
