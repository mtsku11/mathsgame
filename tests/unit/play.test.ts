import { describe, expect, it } from 'vitest';
import { destinationOf, destinations } from '../../src/ui/art/planets';
import { beamPaths } from '../../src/ui/components/hub';
import { geoOf, rowLength, starSize, zones, type Geo } from '../../src/ui/components/objects';

const questions: number[][] = [];
for (let n = 1; n <= 5; n++) questions.push([n]);
for (let a = 1; a < 10; a++) for (let b = 1; a + b <= 10; b++) questions.push([a, b]);

// Mirrors the play.css rules for .sp-obj, .sp-badge and .sp-plus.
function extent(groups: number[], size: number, geo: Geo): { width: number; height: number } {
  const zone = zones[geo];
  const columns = groups.map(n => Math.min(n, rowLength));
  const total = columns.reduce((a, b) => a + b, 0);
  const rows = Math.max(...groups.map(n => Math.ceil(n / rowLength)));
  const badge = Math.min(30, Math.max(14, size * 0.42));
  return {
    width: total * size + (total - groups.length) * zone.gap + (groups.length > 1 ? zone.plus : 0),
    height: rows * (size + badge - size * 0.18) + (rows - 1) * zone.gap,
  };
}

describe('counting-area layout', () => {
  it.each([1, 2, 4] as Geo[])('fits every question and help badge in the layout for %i', geo => {
    for (const groups of questions) {
      const size = starSize(groups, zones[geo]);
      const { width, height } = extent(groups, size, geo);
      expect(width, groups.join('+')).toBeLessThanOrEqual(zones[geo].w);
      expect(height, groups.join('+')).toBeLessThanOrEqual(zones[geo].h + 0.5);
      expect(size).toBeGreaterThanOrEqual({ 1: 58, 2: 36, 4: 28 }[geo]);
      expect(size).toBeLessThanOrEqual(zones[geo].max);
    }
  });
  it('keeps the largest stars for counting and shrinks 9+1 and 5+5 rather than overflowing', () => {
    expect(starSize([5], zones[4])).toBe(60);
    expect(starSize([1], zones[1])).toBe(zones[1].max);
    expect(starSize([9, 1], zones[4])).toBeLessThan(starSize([4, 1], zones[4]));
    expect(starSize([5, 5], zones[4])).toBeLessThan(starSize([3, 2], zones[4]));
  });
  it('maps player counts to layouts', () => {
    expect([1, 2, 3, 4].map(geoOf)).toEqual([1, 2, 4, 4]);
  });
});

describe('journey destinations', () => {
  it('spends two rounds at each destination', () => {
    expect([1, 2, 3, 4, 5, 6].map(destinationOf)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(destinations.map(stop => stop.name)).toEqual(['Golden Rings', 'Candy Planet', 'Frosty Moon']);
  });
});

describe('mothership beams', () => {
  it('draws one beam per station in 3-4 player layouts and two in 1-2 player layouts', () => {
    expect(beamPaths(4, 4).map(beam => beam.slot)).toEqual([0, 1, 2, 3]);
    expect(beamPaths(3, 4)).toHaveLength(3);
    expect(beamPaths(2, 2).map(beam => beam.slot)).toEqual([0, 0, 1, 1]);
    expect(beamPaths(1, 1).map(beam => beam.slot)).toEqual([0, 0]);
  });
  it('starts each beam on its station edge', () => {
    expect(beamPaths(4, 4).map(beam => beam.d.split(' ').slice(0, 2).join(' '))).toEqual(['M540 236', 'M740 236', 'M540 566', 'M740 566']);
    expect(beamPaths(1, 1)[0].d.startsWith('M920 236')).toBe(true);
  });
});
