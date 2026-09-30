import {
  arriveAtMs, countdownOf, createBoost, fillFraction, finalTier, heatOf, idleMs, inWrap, press, setPaused, skip, themeForRound, tick, timeLeftFraction,
  type BoostEvent, type BoostPhase, type BoostState,
} from '../game/boost';
import type { Side } from '../game/questions';
import type { Pair } from '../input/normalize';
import { PressCounter } from '../input/pressCounter';
import type { Settings } from '../settings';
import { destinationOf, destinations } from '../ui/art/planets';
import type { BoostSnapshot, BoostView } from '../ui/screens/boost';
import { events, type BoostTier } from './events';

// idle: no boost this round yet. waiting: the round is ready and a boost is offered (starts by itself after the celebration, or when the teacher presses the hub button).
// running: intro, live, finale or wrap. done: it has ended or been skipped, so the round continues as normal.
export type BoostFlow = 'idle' | 'waiting' | 'running' | 'done';
export type Destination = 0 | 1 | 2;
export interface BoostRunEnv {
  settings: Settings;
  view: BoostView;
  // Reduced motion, low stimulation or instant mode: no star flight to wait for before the celebration ends.
  calm(): boolean;
  round(): number;
  stars(): number;
  announce(message: string): void;
  // The crew has reached the next destination during a Warp Drive finale.
  arrived(destination: Destination): void;
  ended(mode: 'wrapped' | 'skipped'): void;
}
export interface BoostRun {
  readonly flow: BoostFlow;
  readonly state: BoostState | null;
  readonly phase: BoostPhase | null;
  // Set once a Warp Drive finale has reached the next planet, and until the next round starts, so the hub and route already show it.
  readonly arrival: Destination | null;
  reset(): void;
  ready(): void;
  newRound(): void;
  start(held: Pair[], now: number): void;
  frame(states: Pair[], now: number, dt: number, running: boolean): void;
  pause(now: number): void;
  resume(now: number, held: Pair[]): void;
  skip(): void;
  interrupt(): void;
  snapshot(): BoostSnapshot | null;
}

// How long the round-ready celebration gets before an automatic boost starts: 2.5 s banner, plus the time a star may still be flying to the core in full motion.
export const celebrationMs = (calm: boolean): number => calm ? 2600 : 3800;
const words: Record<BoostTier, string> = { 1: 'Boost!', 2: 'Super!', 3: 'Mega!' };
const badges: Record<BoostTier, string> = { 1: 'Boost!', 2: 'Super boost!', 3: 'Mega boost!' };

const arrivalOf = (round: number): Destination | null => round < 6 && destinationOf(round + 1) !== destinationOf(round) ? destinationOf(round + 1) : null;

export function createBoostRun(env: BoostRunEnv): BoostRun {
  let flow: BoostFlow = 'idle';
  let state: BoostState | null = null;
  let counter: PressCounter | null = null;
  let wait = 0;
  let arrival: Destination | null = null;
  let arrivedNow = false;
  let counted: number | null = null;
  const players = (): number => env.settings.count;

  function snapshot(): BoostSnapshot | null {
    const s = state;
    if (!s) return null;
    return {
      phase: s.phase, fraction: fillFraction(s), timeLeft: timeLeftFraction(s), countdown: countdownOf(s), wrap: inWrap(s), finaleTier: s.finaleTier,
      heat: s.recent.map((_, i) => heatOf(s, i)), idle: s.recent.map((_, i) => idleMs(s, i)),
    };
  }

  function finish(mode: 'wrapped' | 'skipped'): void {
    const tier = state ? finalTier(state) : 1;
    state = null;
    counter = null;
    flow = 'done';
    events.emit('boostEnd', { tier });
    env.view.end(mode);
    env.announce(mode === 'wrapped' ? `${badges[tier]} Well done, crew.` : 'Boost round skipped.');
    env.ended(mode);
  }

  function handle(list: BoostEvent[], side: Side): void {
    for (const event of list) {
      if (!state) return;
      switch (event.type) {
        case 'go': events.emit('boostGo'); env.view.go(); env.announce('Go! Press your switches as fast as you can.'); break;
        case 'press': events.emit('boostPress', { player: event.player, side }); env.view.press(event.player); break;
        case 'tier': events.emit('boostTier', { tier: event.tier }); env.view.tier(event.tier); env.announce(words[event.tier]); break;
        case 'finale': events.emit('boostFinale', { tier: event.tier }); env.view.finale(event.tier); break;
        case 'end': finish('wrapped'); break;
      }
    }
  }

  function start(held: Pair[], now: number): void {
    const round = env.round();
    const theme = themeForRound(round);
    const count = players();
    state = createBoost({
      theme, players: count, powers: env.settings.players.slice(0, count).map(player => player.boostPower), difficulty: env.settings.boost.difficulty,
      durationMs: env.settings.boost.seconds * 1000, now,
    });
    counter = new PressCounter(count);
    counter.sample(held.slice(0, count), now);
    flow = 'running';
    arrivedNow = false;
    counted = null;
    const next = theme === 'warpDrive' ? arrivalOf(round) : null;
    events.emit('boostStart', { round, theme });
    env.view.begin({ round, theme, players: count, stars: env.stars(), destination: next === null ? null : destinations[next] });
    env.announce('Boost round! Press your switches as fast as you can. Starting in 3, 2, 1.');
  }

  return {
    get flow() { return flow; },
    get state() { return state; },
    get phase() { return state?.phase ?? null; },
    get arrival() { return arrival; },
    reset() { flow = 'idle'; state = null; counter = null; wait = 0; arrival = null; arrivedNow = false; },
    ready() { if (env.settings.boost.enabled) { flow = 'waiting'; wait = 0; } },
    newRound() { flow = 'idle'; wait = 0; arrival = null; },
    start,
    frame(states, now, dt, running) {
      if (flow === 'waiting') {
        if (running && env.settings.boost.autoStart) { wait += dt; if (wait >= celebrationMs(env.calm())) start(states, now); }
        return;
      }
      const s = state;
      if (flow !== 'running' || !s || !counter || s.paused) return;
      for (const { pupil, side } of counter.sample(states.slice(0, players()), now)) handle(press(s, pupil, now), side);
      if (!state) return;
      handle(tick(s, now), 0);
      if (!state) return;
      const count = countdownOf(s);
      if (count !== null && count !== counted) { counted = count; events.emit('boostCount', { n: count as 1 | 2 | 3 }); }
      const at = arriveAtMs(s);
      if (!arrivedNow && at !== null && s.phase === 'finale' && s.phaseTime >= at) {
        arrivedNow = true;
        const next = arrivalOf(env.round());
        if (next !== null) { arrival = next; env.view.arrive(); env.arrived(next); } else if (s.theme === 'warpDrive') events.emit('homeReached');
      }
      const shot = snapshot();
      if (shot) env.view.update(shot);
    },
    pause(now) {
      if (!state) return;
      setPaused(state, true, now);
      env.view.setPaused(true);
    },
    resume(now, held) {
      if (!state) return;
      setPaused(state, false, now);
      counter?.reset();
      counter?.sample(held.slice(0, players()), now);
      env.view.setPaused(false);
    },
    skip() {
      if (!state) return;
      skip(state);
      finish('skipped');
    },
    // The screen is going away mid-boost (controller recovery): the boost starts again from its intro afterwards rather than resuming half-drawn.
    interrupt() { if (flow === 'running') { state = null; counter = null; flow = 'waiting'; wait = 0; } },
    snapshot,
  };
}
