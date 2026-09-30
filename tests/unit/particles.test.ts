import { describe, expect, it } from 'vitest';
import { ParticleSim, SHAPES, type ParticleSpec } from '../../src/ui/fx/particleSim';

const spec = (over: Partial<ParticleSpec> = {}): ParticleSpec => ({ x: 10, y: 20, vx: 100, vy: 0, life: 1, size: 20, tint: 0xFFD23F, shape: 'star', ...over });

describe('particle simulation', () => {
  it('never holds more particles than the cap and refuses spawns beyond it', () => {
    const sim = new ParticleSim(50);
    sim.cap = 10;
    const accepted = Array.from({ length: 30 }, () => sim.spawn(spec())).filter(Boolean).length;
    expect(accepted).toBe(10);
    expect(sim.count).toBe(10);
    sim.cap = 4;
    expect(sim.spawn(spec())).toBe(false);
    sim.step(2);
    expect(sim.count).toBe(0);
    expect(sim.spawn(spec())).toBe(true);
  });

  it('integrates velocity, gravity and drag, and expires particles at the end of their life', () => {
    const sim = new ParticleSim(8);
    sim.spawn(spec({ vx: 100, vy: 0, gravity: 200 }));
    sim.step(0.5);
    expect(sim.x[0]).toBeCloseTo(10 + 100 * 0.5, 3);
    expect(sim.y[0]).toBeCloseTo(20 + 200 * 0.5 * 0.5, 3);
    sim.step(0.6);
    expect(sim.count).toBe(0);
    sim.spawn(spec({ vx: 100, drag: 2 }));
    sim.step(0.1);
    expect(sim.vx[0]).toBeCloseTo(80, 3);
  });

  it('keeps live slots contiguous when an early particle dies, moving the last live particle into its slot', () => {
    const sim = new ParticleSim(8);
    sim.spawn(spec({ life: 0.2, x: 1, tint: 0xFF0000, shape: 'dot' }));
    sim.spawn(spec({ life: 5, x: 2, vx: 0, tint: 0x00FF00, shape: 'sparkle' }));
    sim.spawn(spec({ life: 5, x: 3, vx: 0, tint: 0x0000FF, shape: 'strip' }));
    sim.step(0.25);
    expect(sim.count).toBe(2);
    expect([sim.x[0], sim.x[1]]).toEqual([3, 2]);
    expect(SHAPES[sim.shape[0]]).toBe('strip');
    expect(sim.bgr[0]).toBe(0xFF0000);
  });

  it('pops in quickly, holds, then fades to nothing over the last part of its life', () => {
    const sim = new ParticleSim(4);
    sim.spawn(spec({ life: 1, size: 30, endSize: 30, fadeFrom: 0.5, vx: 0 }));
    expect(sim.scaleAt(0)).toBe(0);
    sim.step(0.03);
    expect(sim.scaleAt(0)).toBeCloseTo(15, 0);
    sim.step(0.07);
    expect(sim.scaleAt(0)).toBeCloseTo(30, 1);
    expect(sim.alphaAt(0)).toBe(1);
    sim.step(0.6);
    expect(sim.alphaAt(0)).toBeCloseTo(0.6, 1);
    sim.step(0.29);
    expect(sim.alphaAt(0)).toBeLessThan(0.05);
  });

  it('emitters spawn at their rate for their duration, respect the cap, then stop', () => {
    const sim = new ParticleSim(400);
    sim.emit({ duration: 2, rate: 50, make: () => spec({ life: 10 }) });
    expect(sim.active).toBe(true);
    for (let i = 0; i < 120; i++) sim.step(1 / 60);
    expect(sim.count).toBeGreaterThanOrEqual(98);
    expect(sim.count).toBeLessThanOrEqual(101);
    expect(sim.emitting).toBe(false);
    const before = sim.count;
    for (let i = 0; i < 30; i++) sim.step(1 / 60);
    expect(sim.count).toBe(before);

    const capped = new ParticleSim(400);
    capped.cap = 30;
    capped.emit({ duration: 3, rate: 500, make: () => spec({ life: 10 }) });
    for (let i = 0; i < 60; i++) capped.step(1 / 60);
    expect(capped.count).toBe(30);
  });

  it('is inactive once everything has died and clear() removes emitters as well', () => {
    const sim = new ParticleSim(10);
    sim.spawn(spec({ life: 0.1 }));
    sim.emit({ duration: 5, rate: 10, make: () => spec() });
    sim.clear();
    expect(sim.active).toBe(false);
    expect(sim.count).toBe(0);
  });

  it('flutter narrows confetti to a sliver and back, and is 1 for particles that do not flutter', () => {
    const sim = new ParticleSim(4);
    sim.spawn(spec({ flutter: 10, vx: 0 }));
    sim.spawn(spec({ vx: 0 }));
    const widths = new Set<number>();
    for (let i = 0; i < 30; i++) { sim.step(0.01); widths.add(+sim.flipAt(0).toFixed(2)); }
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.15);
    expect(Math.max(...widths)).toBeLessThanOrEqual(1);
    expect(widths.size).toBeGreaterThan(3);
    expect(sim.flipAt(1)).toBe(1);
  });
});
