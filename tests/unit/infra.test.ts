import { describe, expect, it, vi } from 'vitest';
import { createBus, type GameEvents } from '../../src/app/events';
import { createRouter, type Screen } from '../../src/app/router';
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from '../../src/ui/stage';

describe('event bus', () => {
  it('delivers typed payloads to subscribers and stops after off or unsubscribe', () => {
    const bus = createBus<GameEvents>();
    const seen: number[] = [], other = vi.fn();
    const handler = ({ player }: GameEvents['answerCorrect']) => seen.push(player);
    const unsubscribe = bus.on('answerCorrect', handler);
    bus.on('answerTry', other);
    bus.emit('answerCorrect', { player: 1, side: 0 });
    unsubscribe();
    bus.emit('answerCorrect', { player: 2, side: 1 });
    bus.on('answerCorrect', handler);
    bus.off('answerCorrect', handler);
    bus.emit('answerCorrect', { player: 3, side: 0 });
    expect(seen).toEqual([1]);
    expect(other).not.toHaveBeenCalled();
  });
  it('supports payload-free events and isolates failing handlers', () => {
    const bus = createBus<GameEvents>();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = vi.fn();
    bus.on('boostGo', () => { throw new Error('boom'); });
    bus.on('boostGo', ok);
    bus.emit('boostGo');
    expect(ok).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
  it('lets a handler unsubscribe itself during emit without skipping others', () => {
    const bus = createBus<GameEvents>();
    const calls: string[] = [];
    const first = () => { calls.push('first'); bus.off('roundReady', first); };
    bus.on('roundReady', first);
    bus.on('roundReady', () => calls.push('second'));
    bus.emit('roundReady', { round: 1 });
    bus.emit('roundReady', { round: 2 });
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});

describe('router', () => {
  const container = () => ({ cleared: 0, replaceChildren() { this.cleared++; } });
  const screen = (log: string[], name: string): Screen => ({ mount: () => log.push(`mount ${name}`), unmount: () => log.push(`unmount ${name}`) });
  it('unmounts the previous screen before mounting the next', () => {
    const log: string[] = [], host = container();
    const router = createRouter<'a' | 'b'>(host as unknown as HTMLElement);
    router.register('a', screen(log, 'a'));
    router.register('b', screen(log, 'b'));
    expect(router.current()).toBeNull();
    router.go('a'); router.go('b');
    expect(log).toEqual(['mount a', 'unmount a', 'mount b']);
    expect(router.current()).toBe('b');
    expect(host.cleared).toBe(2);
  });
  it('rejects unknown screens without changing the current one', () => {
    const log: string[] = [];
    const router = createRouter<'a' | 'missing'>(container() as unknown as HTMLElement);
    router.register('a', screen(log, 'a'));
    router.go('a');
    expect(() => router.go('missing')).toThrow('Unknown screen');
    expect(router.current()).toBe('a');
    expect(log).toEqual(['mount a']);
  });
});

describe('stage scale', () => {
  it('fits the logical stage inside any window while preserving aspect ratio', () => {
    expect(fitScale(1280, 720)).toBe(1);
    expect(fitScale(1920, 1080)).toBe(1.5);
    expect(fitScale(1366, 768)).toBeCloseTo(768 / 720, 6);
    expect(fitScale(800, 600)).toBeCloseTo(0.625, 6);
    expect(fitScale(390, 844)).toBeCloseTo(390 / STAGE_WIDTH, 6);
    for (const [w, h] of [[1280, 720], [1920, 1080], [1366, 768], [800, 600], [390, 844], [2560, 1080]]) {
      const s = fitScale(w, h);
      expect(STAGE_WIDTH * s).toBeLessThanOrEqual(w + 1e-9);
      expect(STAGE_HEIGHT * s).toBeLessThanOrEqual(h + 1e-9);
    }
  });
});
