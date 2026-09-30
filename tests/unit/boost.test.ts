import { describe, expect, it } from 'vitest';
import {
  ARRIVE_BEFORE_END_MS, HEAT_FULL, INTRO_MS, PAYOFF_MS, WRAP_MS, arriveAtMs, countdownOf, createBoost, fillFraction, finalTier, heatOf, idleMs, inWrap, press, setPaused, skip, targetFor, themeForRound, tick, tierOf, timeLeftFraction,
  type BoostEvent, type BoostOptions, type BoostState,
} from '../../src/game/boost';

const make = (options: Partial<BoostOptions> = {}): BoostState => createBoost({ theme: 'warpDrive', players: 1, difficulty: 'easy', durationMs: 12000, now: 0, ...options });
// A boost that is already live at clock 0 of the live phase.
const live = (options: Partial<BoostOptions> = {}): BoostState => { const state = make(options); tick(state, INTRO_MS); return state; };
const types = (events: BoostEvent[]): string[] => events.map(event => event.type === 'tier' || event.type === 'finale' || event.type === 'end' ? `${event.type}${event.tier}` : event.type);

describe('boost targets and tiers', () => {
  it('sums 12, 20 and 32 presses per pupil over the crew', () => {
    expect([1, 2, 3, 4].map(n => targetFor(n, 'easy'))).toEqual([12, 24, 36, 48]);
    expect([1, 2, 3, 4].map(n => targetFor(n, 'normal'))).toEqual([20, 40, 60, 80]);
    expect([1, 2, 3, 4].map(n => targetFor(n, 'hard'))).toEqual([32, 64, 96, 128]);
    expect(make({ players: 3, difficulty: 'normal' }).target).toBe(60);
  });

  it('puts tier thresholds at one third, two thirds and full, with no rounding surprises when the target does not divide by three', () => {
    expect([0, 3, 4, 7, 8, 11, 12].map(energy => tierOf(energy, 12))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect([0, 6, 7, 13, 14, 19, 20].map(energy => tierOf(energy, 20))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect([0, 13, 14, 26, 27, 39, 40].map(energy => tierOf(energy, 40))).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('starts at tier 0 with no energy', () => {
    const state = make();
    expect(state).toMatchObject({ phase: 'intro', tier: 0, energy: 0, target: 12, paused: false });
    expect(fillFraction(state)).toBe(0);
  });
});

describe('boost timing and phases', () => {
  it('runs intro, live, finale and done, and emits an event at each change', () => {
    const state = make({ durationMs: 8000 });
    expect(types(tick(state, 4499))).toEqual([]);
    expect(state.phase).toBe('intro');
    expect(types(tick(state, 4500))).toEqual(['go']);
    expect(state.phase).toBe('live');
    expect(types(tick(state, 4500 + 7999))).toEqual([]);
    expect(types(tick(state, 4500 + 8000))).toEqual(['finale1']);
    expect(state.phase).toBe('finale');
    const total = PAYOFF_MS.warpDrive[1] + WRAP_MS;
    expect(types(tick(state, 12500 + total - 1))).toEqual([]);
    expect(types(tick(state, 12500 + total))).toEqual(['end1']);
    expect(state.phase).toBe('done');
    expect(tick(state, 99999)).toEqual([]);
  });

  it('crosses several phases in one long tick without losing events', () => {
    const state = make({ durationMs: 8000 });
    expect(types(tick(state, 100000))).toEqual(['go', 'finale1', 'end1']);
    expect(state.phase).toBe('done');
  });

  it('counts down 3, 2, 1 through the intro', () => {
    const state = make();
    const shown = [0, 1000, 1500, 2000, 2400, 3000, 3499, 3600, 4400].map(now => { tick(state, now); return countdownOf(state); });
    expect(shown).toEqual([null, null, 3, 3, 3, 2, 2, 1, 1]);
    tick(state, INTRO_MS);
    expect(countdownOf(state)).toBeNull();
  });

  it('ends the live phase at the tier reached when time runs out, and never below tier 1', () => {
    for (const [presses, tier] of [[0, 1], [4, 1], [8, 2], [11, 2]] as const) {
      const state = live({ durationMs: 8000 });
      for (let i = 0; i < presses; i++) press(state, 0, INTRO_MS + 100 + i * 100);
      const events = tick(state, INTRO_MS + 8000);
      expect(types(events)).toEqual([`finale${tier}`]);
      expect(state.finaleTier).toBe(tier);
      expect(finalTier(state)).toBe(tier);
    }
    const idle = live();
    tick(idle, INTRO_MS + 12000);
    expect(idle.tier).toBe(0);
    expect(finalTier(idle)).toBe(1);
  });

  it('reaching full power ends the live phase immediately with MAX', () => {
    const state = live();
    let events: BoostEvent[] = [];
    for (let i = 0; i < 12; i++) events = press(state, 0, INTRO_MS + 500 + i * 100);
    expect(types(events)).toEqual(['press', 'tier3', 'finale3']);
    expect(state.phase).toBe('finale');
    expect(state.finaleTier).toBe(3);
    expect(state.energy).toBe(12);
    expect(state.finaleMs).toBe(PAYOFF_MS.warpDrive[3] + WRAP_MS);
    expect(state.phaseTime).toBe(0);
  });

  it('emits each tier once, in order, as the meter fills', () => {
    const state = live();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) seen.push(...types(press(state, 0, INTRO_MS + 100 * (i + 1))).filter(type => type.startsWith('tier')));
    expect(seen).toEqual(['tier1', 'tier2', 'tier3']);
  });

  it('finishes the finale and the wrap by time even after an early MAX', () => {
    const state = live();
    for (let i = 0; i < 12; i++) press(state, 0, INTRO_MS + 100 * (i + 1));
    const maxAt = INTRO_MS + 1200;
    expect(inWrap(state)).toBe(false);
    tick(state, maxAt + PAYOFF_MS.warpDrive[3]);
    expect(inWrap(state)).toBe(true);
    expect(types(tick(state, maxAt + PAYOFF_MS.warpDrive[3] + WRAP_MS))).toEqual(['end3']);
  });

  it('reports how much of the live time is left', () => {
    const state = make({ durationMs: 10000 });
    expect(timeLeftFraction(state)).toBe(1);
    tick(state, INTRO_MS + 2500);
    expect(timeLeftFraction(state)).toBeCloseTo(0.75);
    tick(state, INTRO_MS + 10000);
    expect(timeLeftFraction(state)).toBe(0);
  });
});

describe('boost pressing', () => {
  it('ignores presses before GO and does not queue them', () => {
    const state = make();
    expect(press(state, 0, 1000)).toEqual([]);
    expect(press(state, 0, 4499)).toEqual([]);
    tick(state, INTRO_MS);
    expect(state.energy).toBe(0);
    expect(types(press(state, 0, INTRO_MS + 10))).toEqual(['press']);
    expect(state.energy).toBe(1);
  });

  it('ignores presses once the finale has started', () => {
    const state = live({ durationMs: 8000 });
    press(state, 0, INTRO_MS + 100);
    tick(state, INTRO_MS + 8000);
    expect(state.phase).toBe('finale');
    expect(press(state, 0, INTRO_MS + 8100)).toEqual([]);
    expect(state.energy).toBe(1);
  });

  it('ignores a press that arrives after time has run out even if no frame ticked in between', () => {
    const state = live({ durationMs: 8000 });
    const events = press(state, 0, INTRO_MS + 8050);
    expect(types(events)).toEqual(['finale1']);
    expect(state.energy).toBe(0);
  });

  it('weights each press by that pupil\'s boost power', () => {
    const state = live({ players: 3, powers: [1, 2, 3], difficulty: 'normal' });
    press(state, 0, INTRO_MS + 100);
    expect(state.energy).toBe(1);
    press(state, 1, INTRO_MS + 200);
    expect(state.energy).toBe(3);
    press(state, 2, INTRO_MS + 300);
    expect(state.energy).toBe(6);
    expect(state.target).toBe(60);
  });

  it('lets a slow pupil with power 3 contribute as much as a fast pupil with power 1', () => {
    const fast = live({ players: 2, powers: [1, 1], difficulty: 'easy' });
    const slow = live({ players: 2, powers: [1, 3], difficulty: 'easy' });
    for (let i = 0; i < 9; i++) press(fast, 0, INTRO_MS + 100 * (i + 1));
    for (let i = 0; i < 3; i++) press(slow, 1, INTRO_MS + 100 * (i + 1));
    expect(fast.energy).toBe(9);
    expect(slow.energy).toBe(9);
    expect(fast.tier).toBe(slow.tier);
  });

  it('a press that crosses two tiers at once emits both, and energy never exceeds the target', () => {
    const state = live({ powers: [3], difficulty: 'easy' });
    for (let i = 0; i < 3; i++) press(state, 0, INTRO_MS + 100 * (i + 1));
    expect(state.energy).toBe(9);
    expect(state.tier).toBe(2);
    const events = press(state, 0, INTRO_MS + 500);
    expect(types(events)).toEqual(['press', 'tier3', 'finale3']);
    expect(state.energy).toBe(12);
    expect(fillFraction(state)).toBe(1);
    const jump = live({ powers: [3] });
    jump.energy = 3;
    expect(types(press(jump, 0, INTRO_MS + 100))).toEqual(['press', 'tier1']);
    jump.energy = 7;
    expect(types(press(jump, 0, INTRO_MS + 200))).toEqual(['press', 'tier2']);
  });

  it('ignores unknown pupils', () => {
    const state = live({ players: 2 });
    expect(press(state, 2, INTRO_MS + 100)).toEqual([]);
    expect(press(state, -1, INTRO_MS + 100)).toEqual([]);
    expect(state.energy).toBe(0);
  });

  it('clamps boost power into 1..3', () => {
    expect(make({ players: 3, powers: [0, 7, 2.4] }).powers).toEqual([1, 3, 2]);
    expect(make({ players: 2 }).powers).toEqual([1, 1]);
  });
});

describe('boost pause and skip', () => {
  it('freezes the timer, the countdown and the live time while paused', () => {
    const state = make({ durationMs: 8000 });
    tick(state, 2000);
    setPaused(state, true, 2000);
    tick(state, 60000);
    expect(state.phase).toBe('intro');
    expect(state.phaseTime).toBe(2000);
    setPaused(state, false, 60000);
    tick(state, 62500);
    expect(state.phase).toBe('live');
    expect(state.phaseTime).toBe(0);
    tick(state, 62500 + 3000);
    setPaused(state, true, 65500);
    tick(state, 200000);
    expect(state.phase).toBe('live');
    expect(state.phaseTime).toBe(3000);
    setPaused(state, false, 200000);
    tick(state, 200000 + 5000);
    expect(state.phase).toBe('finale');
  });

  it('records time up to the moment of the pause when nothing ticked just before it', () => {
    const state = make();
    setPaused(state, true, 1500);
    expect(state.phaseTime).toBe(1500);
  });

  it('ignores presses while paused', () => {
    const state = live();
    setPaused(state, true, INTRO_MS + 100);
    expect(press(state, 0, INTRO_MS + 200)).toEqual([]);
    expect(state.energy).toBe(0);
    setPaused(state, false, INTRO_MS + 300);
    expect(types(press(state, 0, INTRO_MS + 310))).toEqual(['press']);
  });

  it('a long pause between two presses does not count as idle time or finish the boost', () => {
    const state = live();
    press(state, 0, INTRO_MS + 100);
    setPaused(state, true, INTRO_MS + 200);
    setPaused(state, false, INTRO_MS + 90000);
    tick(state, INTRO_MS + 90100);
    expect(state.phase).toBe('live');
    expect(idleMs(state, 0)).toBe(200);
  });

  it('skip ends it at once from any phase and is safe to repeat', () => {
    const state = make();
    expect(types(skip(state))).toEqual(['end1']);
    expect(state.phase).toBe('done');
    expect(skip(state)).toEqual([]);
    expect(press(state, 0, 9000)).toEqual([]);
    const later = live();
    for (let i = 0; i < 8; i++) press(later, 0, INTRO_MS + 100 * (i + 1));
    expect(types(skip(later))).toEqual(['end2']);
  });
});

describe('themes, arrival and per-pupil feel', () => {
  it('rotates fireworks after rounds 1 and 5, warp after 2, 4 and 6, bubbles after 3', () => {
    expect([1, 2, 3, 4, 5, 6].map(themeForRound)).toEqual(['fireworkFrenzy', 'warpDrive', 'bubbleBlast', 'warpDrive', 'fireworkFrenzy', 'warpDrive']);
  });

  it('every theme has a payoff for every tier that grows with the tier, all inside the 7 s ceiling', () => {
    for (const theme of ['fireworkFrenzy', 'warpDrive', 'bubbleBlast'] as const) {
      const [a, b, c] = ([1, 2, 3] as const).map(tier => PAYOFF_MS[theme][tier]);
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
      expect(c).toBeLessThanOrEqual(6000);
    }
    expect(PAYOFF_MS.warpDrive[3]).toBe(4500);
  });

  it('only Warp Drive travels, and it arrives 1.3 s before its payoff ends at every tier', () => {
    const warp = live({ theme: 'warpDrive', durationMs: 8000 });
    expect(arriveAtMs(warp)).toBeNull();
    tick(warp, INTRO_MS + 8000);
    expect(arriveAtMs(warp)).toBe(PAYOFF_MS.warpDrive[1] - ARRIVE_BEFORE_END_MS);
    const max = live({ theme: 'warpDrive' });
    for (let i = 0; i < 12; i++) press(max, 0, INTRO_MS + 100 * (i + 1));
    expect(arriveAtMs(max)).toBe(3200);
    const fireworks = live({ theme: 'fireworkFrenzy', durationMs: 8000 });
    tick(fireworks, INTRO_MS + 8000);
    expect(arriveAtMs(fireworks)).toBeNull();
  });

  it('heat follows presses in the last second and cools when the pupil stops', () => {
    const state = live({ players: 2, durationMs: 20000 });
    for (let i = 0; i < 3; i++) press(state, 0, INTRO_MS + 100 * (i + 1));
    expect(heatOf(state, 0)).toBeCloseTo(3 / HEAT_FULL);
    expect(heatOf(state, 1)).toBe(0);
    for (let i = 0; i < 10; i++) press(state, 0, INTRO_MS + 300 + 50 * (i + 1));
    expect(heatOf(state, 0)).toBe(1);
    tick(state, INTRO_MS + 2500);
    expect(heatOf(state, 0)).toBe(0);
  });

  it('measures idle time per pupil from GO or their last press', () => {
    const state = live({ players: 2, durationMs: 20000 });
    tick(state, INTRO_MS + 4000);
    expect(idleMs(state, 0)).toBe(4000);
    expect(idleMs(state, 1)).toBe(4000);
    press(state, 1, INTRO_MS + 4100);
    expect(idleMs(state, 1)).toBe(0);
    expect(idleMs(state, 0)).toBe(4100);
    expect(idleMs(make(), 0)).toBe(0);
  });
});
