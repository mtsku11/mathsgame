import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrationMs, createBoostRun, type BoostRun } from '../../src/app/boostRun';
import { events, type GameEvents } from '../../src/app/events';
import { INTRO_MS, PAYOFF_MS, WRAP_MS } from '../../src/game/boost';
import type { Pair } from '../../src/input/normalize';
import { defaultSettings, type Settings } from '../../src/settings';
import type { BoostView } from '../../src/ui/screens/boost';

const off: Pair = [false, false], left: Pair = [true, false];
const release = (players: number): Pair[] => Array.from({ length: players }, () => off);

interface Fixture { run: BoostRun; view: Record<keyof BoostView, ReturnType<typeof vi.fn>>; settings: Settings; state: { round: number; calm: boolean }; arrived: number[]; ended: string[]; log: string[]; clock: { now: number } }
let unsubscribe: (() => void)[] = [];

function fixture(round = 1, count = 2, patch: (settings: Settings) => void = () => {}): Fixture {
  const settings = defaultSettings();
  settings.count = count;
  settings.boost.difficulty = 'easy';
  settings.boost.seconds = 8;
  patch(settings);
  const state = { round, calm: true };
  const view = { active: vi.fn(), begin: vi.fn(), update: vi.fn(), go: vi.fn(), press: vi.fn(), tier: vi.fn(), finale: vi.fn(), arrive: vi.fn(), end: vi.fn(), setPaused: vi.fn() };
  const arrived: number[] = [], ended: string[] = [], log: string[] = [];
  for (const name of ['boostStart', 'boostGo', 'boostPress', 'boostTier', 'boostFinale', 'boostEnd'] as (keyof GameEvents)[]) {
    unsubscribe.push(events.on(name, ((payload: { tier?: number; player?: number }) => { log.push(payload?.tier !== undefined ? `${name}${payload.tier}` : name); }) as never));
  }
  const run = createBoostRun({
    settings, view: view as unknown as BoostView, calm: () => state.calm, round: () => state.round, stars: () => 3, announce: () => {},
    arrived: destination => arrived.push(destination), ended: mode => ended.push(mode),
  });
  return { run, view, settings, state, arrived, ended, log, clock: { now: 0 } };
}

// Runs frames at 16 ms steps until `until` ms have passed, holding `states` for every frame.
function play(f: Fixture, until: number, states: (now: number) => Pair[] = () => release(f.settings.count)): void {
  for (; f.clock.now < until; f.clock.now += 16) f.run.frame(states(f.clock.now), f.clock.now, 16, true);
}
// A pupil's switch pressed for 60 ms and released for 60 ms, forever.
const tapping = (pupil: number, count: number) => (now: number): Pair[] => Array.from({ length: count }, (_, i) => i === pupil && Math.floor(now / 60) % 2 === 0 ? left : off);

beforeEach(() => { vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }); });
afterEach(() => { unsubscribe.forEach(off => off()); unsubscribe = []; vi.unstubAllGlobals(); });

describe('boost flow', () => {
  it('offers a boost when the round is ready, only if boost rounds are on', () => {
    const on = fixture();
    expect(on.run.flow).toBe('idle');
    on.run.ready();
    expect(on.run.flow).toBe('waiting');
    const disabled = fixture(1, 2, settings => { settings.boost.enabled = false; });
    disabled.run.ready();
    expect(disabled.run.flow).toBe('idle');
  });

  it('starts by itself after the celebration only while the game is running and start automatically is on', () => {
    const f = fixture();
    f.run.ready();
    for (let t = 0; t < celebrationMs(true) + 500; t += 16) f.run.frame(release(2), t, 16, false);
    expect(f.run.flow).toBe('waiting');
    play(f, celebrationMs(true) - 100);
    expect(f.run.flow).toBe('waiting');
    play(f, celebrationMs(true) + 100);
    expect(f.run.flow).toBe('running');
    expect(f.log).toEqual(['boostStart']);

    const manual = fixture(1, 2, settings => { settings.boost.autoStart = false; });
    manual.run.ready();
    play(manual, 20000);
    expect(manual.run.flow).toBe('waiting');
    manual.run.start(release(2), 20000);
    expect(manual.run.flow).toBe('running');
    expect(celebrationMs(false)).toBeGreaterThan(celebrationMs(true));
  });

  it('creates the boost from the settings and tells the view where the crew is heading', () => {
    const f = fixture(2, 3, settings => { settings.players[1].boostPower = 3; settings.boost.difficulty = 'hard'; settings.boost.seconds = 16; });
    f.run.ready();
    f.run.start(release(3), 0);
    expect(f.run.state).toMatchObject({ players: 3, powers: [1, 3, 1], target: 96, durationMs: 16000, theme: 'warpDrive' });
    expect(f.view.begin).toHaveBeenCalledWith({ round: 2, theme: 'warpDrive', players: 3, stars: 3, destination: { name: 'Candy Planet', kind: 'candy', accent: '#FFC2DF' } });
    const other = (round: number) => { const g = fixture(round); g.run.start(release(2), 0); return g.view.begin.mock.calls[0][0]; };
    expect(other(1)).toMatchObject({ theme: 'fireworkFrenzy', destination: null });
    expect(other(3)).toMatchObject({ theme: 'bubbleBlast', destination: null });
    expect(other(4)).toMatchObject({ theme: 'warpDrive', destination: { name: 'Frosty Moon' } });
    expect(other(6)).toMatchObject({ theme: 'warpDrive', destination: null });
  });
});

describe('boost events and the view', () => {
  it('turns presses into events and view calls, and runs intro, live, finale and wrap to done', () => {
    const f = fixture(1, 1, settings => { settings.boost.seconds = 20; });
    f.run.ready();
    f.run.start(release(1), 0);
    play(f, INTRO_MS - 100, tapping(0, 1));
    expect(f.state.round).toBe(1);
    expect(f.log).toEqual(['boostStart']);
    expect(f.view.press).not.toHaveBeenCalled();
    play(f, INTRO_MS + 100);
    expect(f.log).toEqual(['boostStart', 'boostGo']);
    expect(f.view.go).toHaveBeenCalledTimes(1);
    play(f, INTRO_MS + 6000, tapping(0, 1));
    expect(f.log.filter(name => name.startsWith('boostTier'))).toEqual(['boostTier1', 'boostTier2', 'boostTier3']);
    expect(f.log).toContain('boostFinale3');
    expect(f.view.tier.mock.calls.map(call => call[0])).toEqual([1, 2, 3]);
    expect(f.view.finale).toHaveBeenCalledWith(3);
    expect(f.view.press).toHaveBeenCalledTimes(12);
    expect(f.run.phase).toBe('finale');
    expect(f.run.snapshot()).toMatchObject({ phase: 'finale', fraction: 1, finaleTier: 3, heat: [expect.any(Number)] });
    play(f, INTRO_MS + 20000);
    expect(f.run.flow).toBe('done');
    expect(f.run.state).toBeNull();
    expect(f.log.at(-1)).toBe('boostEnd3');
    expect(f.view.end).toHaveBeenCalledWith('wrapped');
    expect(f.ended).toEqual(['wrapped']);
  });

  it('carries the switch side on boostPress and feeds the view one snapshot per frame', () => {
    const f = fixture(1, 2, settings => { settings.boost.seconds = 20; });
    f.run.start(release(2), 0);
    const sides: number[] = [];
    unsubscribe.push(events.on('boostPress', ({ side }) => sides.push(side)));
    play(f, INTRO_MS + 200);
    play(f, INTRO_MS + 400, now => [off, now < INTRO_MS + 300 ? [false, true] : off]);
    expect(sides).toEqual([1]);
    expect(f.view.update.mock.calls.length).toBeGreaterThan(200);
  });

  it('announces the countdown 3, 2, 1 once each, and home once after the last Warp Drive', () => {
    const f = fixture(6, 1, settings => { settings.boost.seconds = 20; });
    const heard: string[] = [];
    unsubscribe.push(events.on('boostCount', ({ n }) => heard.push(`count${n}`)), events.on('homeReached', () => heard.push('home')), events.on('destinationReached', () => heard.push('destination')));
    f.run.start(release(1), 0);
    play(f, INTRO_MS + 100);
    expect(heard).toEqual(['count3', 'count2', 'count1']);
    play(f, INTRO_MS + 6000, tapping(0, 1));
    play(f, INTRO_MS + 20000);
    expect(heard).toEqual(['count3', 'count2', 'count1', 'home']);
    expect(f.arrived).toEqual([]);

    const mid = fixture(2, 1, settings => { settings.boost.seconds = 20; });
    const arrivals: string[] = [];
    unsubscribe.push(events.on('homeReached', () => arrivals.push('home')));
    mid.run.start(release(1), 0);
    play(mid, INTRO_MS + 6000, tapping(0, 1));
    play(mid, INTRO_MS + 20000);
    expect(arrivals).toEqual([]);
    expect(mid.arrived).toEqual([1]);
  });

  it('a switch held when the boost starts does not count until released and pressed again', () => {
    const f = fixture(1, 1, settings => { settings.boost.seconds = 20; });
    f.run.start([left], 0);
    play(f, INTRO_MS + 1000, () => [left]);
    expect(f.run.state?.energy).toBe(0);
    play(f, INTRO_MS + 1200);
    play(f, INTRO_MS + 1300, () => [left]);
    expect(f.run.state?.energy).toBe(1);
  });

  it('freezes on pause, ignores what is pressed meanwhile, and does not count a switch held at resume', () => {
    const f = fixture(1, 1, settings => { settings.boost.seconds = 20; });
    f.run.start(release(1), 0);
    play(f, INTRO_MS + 500);
    f.run.pause(f.clock.now);
    expect(f.view.setPaused).toHaveBeenLastCalledWith(true);
    const frozen = f.run.state!.phaseTime;
    play(f, f.clock.now + 5000, () => [left]);
    expect(f.run.state).toMatchObject({ phaseTime: frozen, energy: 0, paused: true });
    f.run.resume(f.clock.now, [left]);
    expect(f.view.setPaused).toHaveBeenLastCalledWith(false);
    play(f, f.clock.now + 500, () => [left]);
    expect(f.run.state?.energy).toBe(0);
    expect(f.run.state!.phaseTime).toBeGreaterThan(frozen);
    expect(f.run.state!.phaseTime).toBeLessThan(frozen + 800);
  });

  it('pause and resume do nothing when no boost is running', () => {
    const f = fixture();
    f.run.pause(0);
    f.run.resume(10, release(2));
    expect(f.view.setPaused).not.toHaveBeenCalled();
  });

  it('skip ends it at once from any phase, tells the view, and lets the round carry on', () => {
    const f = fixture();
    f.run.ready();
    f.run.start(release(2), 0);
    play(f, 1000);
    f.run.skip();
    expect(f.run.flow).toBe('done');
    expect(f.run.state).toBeNull();
    expect(f.view.end).toHaveBeenCalledWith('skipped');
    expect(f.ended).toEqual(['skipped']);
    expect(f.log.at(-1)).toBe('boostEnd1');
    f.run.skip();
    expect(f.ended).toEqual(['skipped']);
  });

  it('interrupt (controller recovery) offers the boost again from its intro', () => {
    const f = fixture();
    f.run.ready();
    f.run.start(release(2), 0);
    f.run.interrupt();
    expect(f.run.flow).toBe('waiting');
    expect(f.run.state).toBeNull();
  });
});

describe('Warp Drive arrival', () => {
  const reachMax = (f: Fixture): void => {
    f.run.start(release(1), 0);
    play(f, INTRO_MS + 200);
    const tap = tapping(0, 1);
    for (; f.run.phase === 'live'; f.clock.now += 16) f.run.frame(tap(f.clock.now - (INTRO_MS + 200)), f.clock.now, 16, true);
  };

  it('reaches the next planet once, 1.3 s before the payoff ends, and holds it until the next round', () => {
    const f = fixture(2, 1, settings => { settings.boost.seconds = 20; });
    reachMax(f);
    expect(f.run.phase).toBe('finale');
    const maxAt = f.clock.now;
    expect(f.arrived).toEqual([]);
    expect(f.run.arrival).toBeNull();
    play(f, maxAt + 3400);
    expect(f.arrived).toEqual([1]);
    expect(f.run.arrival).toBe(1);
    expect(f.view.arrive).toHaveBeenCalledTimes(1);
    play(f, maxAt + PAYOFF_MS.warpDrive[3] + WRAP_MS + 500);
    expect(f.arrived).toEqual([1]);
    expect(f.run.arrival).toBe(1);
    f.run.newRound();
    expect(f.run.arrival).toBeNull();
    expect(f.run.flow).toBe('idle');
  });

  it('rounds 4 arrives at the Frosty Moon; rounds 2 and 4 arrive even at tier 1; round 6 warps home with no arrival', () => {
    const f4 = fixture(4, 1, settings => { settings.boost.seconds = 8; });
    f4.run.start(release(1), 0);
    play(f4, INTRO_MS + 12000);
    expect(f4.arrived).toEqual([2]);
    const f6 = fixture(6, 1, settings => { settings.boost.seconds = 8; });
    f6.run.start(release(1), 0);
    play(f6, INTRO_MS + 13000);
    expect(f6.arrived).toEqual([]);
    expect(f6.view.arrive).not.toHaveBeenCalled();
    expect(f6.run.flow).toBe('done');
  });

  it('never arrives on a themed round that is not Warp Drive, or when skipped before the arrival moment', () => {
    const f = fixture(1, 1, settings => { settings.boost.seconds = 8; });
    f.run.start(release(1), 0);
    play(f, INTRO_MS + 12000);
    expect(f.arrived).toEqual([]);
    const skipped = fixture(2, 1, settings => { settings.boost.seconds = 8; });
    skipped.run.start(release(1), 0);
    play(skipped, INTRO_MS + 8100);
    skipped.run.skip();
    expect(skipped.arrived).toEqual([]);
    expect(skipped.run.arrival).toBeNull();
  });
});
