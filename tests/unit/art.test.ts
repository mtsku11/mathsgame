import { describe, expect, it } from 'vitest';
import { ATLAS_SIZE, atlasFrames } from '../../src/ui/art/particles';
import { starOutline, starPoint } from '../../src/ui/art/fireworks';
import { SHAPES } from '../../src/ui/fx/particleSim';

describe('particle atlas', () => {
  it('has a frame for every shape, inside the atlas and overlapping no other frame', () => {
    expect(Object.keys(atlasFrames).sort()).toEqual([...SHAPES].sort());
    const frames = SHAPES.map(shape => atlasFrames[shape]);
    for (const { x, y, w, h } of frames) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(y + h).toBeLessThanOrEqual(ATLAS_SIZE);
    }
    frames.forEach((a, i) => frames.slice(i + 1).forEach(b => {
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }));
  });
});

describe('firework star outline', () => {
  it('starts at the top point, passes through every corner in order and comes back round', () => {
    const corners = starOutline(100, 0.5);
    expect(corners).toHaveLength(10);
    expect(corners[0].x).toBeCloseTo(0, 6);
    expect(corners[0].y).toBeCloseTo(-100, 6);
    expect(Math.hypot(corners[1].x, corners[1].y)).toBeCloseTo(50, 6);
    corners.forEach((corner, j) => {
      const at = starPoint(j / 10, 100, 0.5);
      expect(at.x).toBeCloseTo(corner.x, 6);
      expect(at.y).toBeCloseTo(corner.y, 6);
    });
    expect(starPoint(1, 100, 0.5).y).toBeCloseTo(-100, 6);
  });

  it('places points evenly along the edges, so a shell opens as a star and not a blob', () => {
    const gaps = Array.from({ length: 40 }, (_, i) => { const a = starPoint(i / 40, 100, 0.45), b = starPoint((i + 1) / 40, 100, 0.45); return Math.hypot(a.x - b.x, a.y - b.y); });
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-6);
  });
});
