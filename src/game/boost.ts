import type { BoostTheme, BoostTier } from '../app/events';
import type { BoostDifficulty } from '../settings';

// Pure boost-round logic. Time comes only from the `now` values passed in; nothing here reads a clock, the DOM or an animation.
export type BoostPhase = 'intro' | 'live' | 'finale' | 'done';
export type BoostReached = 0 | BoostTier;

export const INTRO_MS = 4500;
export const WRAP_MS = 1500;
export const HEAT_WINDOW_MS = 1000;
export const HEAT_FULL = 6;
export const IDLE_NUDGE_MS = 4000;
export const COUNTDOWN_FROM_MS = 1500;
export const PER_PLAYER_TARGET: Record<BoostDifficulty, number> = { easy: 12, normal: 20, hard: 32 };
// Length of each theme's payoff at the tier reached; the wrap (tier badge and cheering) follows it. Scenes animate inside these times, they never extend them.
export const PAYOFF_MS: Record<BoostTheme, Record<BoostTier, number>> = {
  warpDrive: { 1: 2800, 2: 3800, 3: 4500 },
  fireworkFrenzy: { 1: 3200, 2: 4700, 3: 6000 },
  bubbleBlast: { 1: 2200, 2: 3000, 3: 4000 },
};
// Where in the payoff the crew reaches the next destination; only Warp Drive travels.
export const ARRIVE_BEFORE_END_MS = 1300;

export interface BoostOptions { theme: BoostTheme; players: number; powers?: number[]; difficulty: BoostDifficulty; durationMs: number; now: number }
export interface BoostState {
  theme: BoostTheme; players: number; powers: number[]; durationMs: number;
  phase: BoostPhase; phaseTime: number; clock: number; last: number; paused: boolean;
  energy: number; target: number; tier: BoostReached; finaleTier: BoostTier | null; finaleMs: number;
  recent: number[][]; lastActive: number[];
}
export type BoostEvent =
  | { type: 'go' }
  | { type: 'press'; player: number }
  | { type: 'tier'; tier: BoostTier }
  | { type: 'finale'; tier: BoostTier }
  | { type: 'end'; tier: BoostTier };

// Fireworks after rounds 1 and 5, Warp Drive after 2, 4 and 6, Bubble Blast after 3.
export function themeForRound(round: number): BoostTheme {
  return round === 3 ? 'bubbleBlast' : round % 2 === 0 ? 'warpDrive' : 'fireworkFrenzy';
}

export const targetFor = (players: number, difficulty: BoostDifficulty): number => PER_PLAYER_TARGET[difficulty] * players;

// Thresholds at one third, two thirds and full, compared in whole numbers so a target that does not divide by three has no rounding surprises.
export function tierOf(energy: number, target: number): BoostReached {
  if (energy >= target) return 3;
  if (energy * 3 >= target * 2) return 2;
  if (energy * 3 >= target) return 1;
  return 0;
}

export function createBoost(options: BoostOptions): BoostState {
  const { theme, players, difficulty, durationMs, now } = options;
  return {
    theme, players, powers: Array.from({ length: players }, (_, i) => Math.min(3, Math.max(1, Math.round(options.powers?.[i] ?? 1)))), durationMs,
    phase: 'intro', phaseTime: 0, clock: 0, last: now, paused: false,
    energy: 0, target: targetFor(players, difficulty), tier: 0, finaleTier: null, finaleMs: 0,
    recent: Array.from({ length: players }, () => []), lastActive: Array.from({ length: players }, () => 0),
  };
}

// The tier the finale plays: running out of time still earns a happy ending, so never below 1.
export const finalTier = (state: BoostState): BoostTier => Math.max(1, state.tier) as BoostTier;
export const payoffMs = (theme: BoostTheme, tier: BoostTier): number => PAYOFF_MS[theme][tier];
export const inWrap = (state: BoostState): boolean => state.phase === 'finale' && state.phaseTime >= state.finaleMs - WRAP_MS;
export const fillFraction = (state: BoostState): number => state.target ? Math.min(1, state.energy / state.target) : 0;
export const timeLeftFraction = (state: BoostState): number => state.phase === 'intro' ? 1 : state.phase === 'live' ? Math.max(0, 1 - state.phaseTime / state.durationMs) : 0;
// The number on screen: 3 from 1.5 s into the intro, then 2, then 1, one per second up to GO. Null before that and once live.
export const countdownOf = (state: BoostState): number | null =>
  state.phase === 'intro' && state.phaseTime >= COUNTDOWN_FROM_MS ? Math.max(1, Math.min(3, Math.ceil((INTRO_MS - state.phaseTime) / 1000))) : null;
// Presses by this pupil in the last second, as 0..1. Only ever drives a glow: nobody sees, keeps or compares a count.
export const heatOf = (state: BoostState, player: number): number => Math.min(1, (state.recent[player]?.length ?? 0) / HEAT_FULL);
export const idleMs = (state: BoostState, player: number): number => state.phase === 'live' ? state.clock - (state.lastActive[player] ?? state.clock) : 0;
// Milliseconds into the finale when the crew reaches the next destination, or null when this theme does not travel.
export const arriveAtMs = (state: BoostState): number | null =>
  state.theme === 'warpDrive' && state.finaleTier ? payoffMs(state.theme, state.finaleTier) - ARRIVE_BEFORE_END_MS : null;

function beginFinale(state: BoostState, events: BoostEvent[]): void {
  const tier = finalTier(state);
  state.phase = 'finale';
  state.finaleTier = tier;
  state.finaleMs = payoffMs(state.theme, tier) + WRAP_MS;
  events.push({ type: 'finale', tier });
}

function advance(state: BoostState, dt: number, events: BoostEvent[]): void {
  state.clock += dt;
  state.phaseTime += dt;
  for (;;) {
    if (state.phase === 'intro' && state.phaseTime >= INTRO_MS) {
      state.phaseTime -= INTRO_MS;
      state.phase = 'live';
      state.lastActive.fill(state.clock - state.phaseTime);
      events.push({ type: 'go' });
    } else if (state.phase === 'live' && state.phaseTime >= state.durationMs) {
      state.phaseTime -= state.durationMs;
      beginFinale(state, events);
    } else if (state.phase === 'finale' && state.phaseTime >= state.finaleMs) {
      state.phase = 'done';
      state.phaseTime = 0;
      events.push({ type: 'end', tier: state.finaleTier ?? finalTier(state) });
    } else break;
  }
  for (const times of state.recent) while (times.length && state.clock - times[0] > HEAT_WINDOW_MS) times.shift();
}

// Moves the boost forward to `now`. While paused, time stands still: the gap between paused frames is discarded.
export function tick(state: BoostState, now: number): BoostEvent[] {
  const events: BoostEvent[] = [];
  const dt = Math.max(0, now - state.last);
  state.last = now;
  if (!state.paused && state.phase !== 'done') advance(state, dt, events);
  return events;
}

export function setPaused(state: BoostState, paused: boolean, now: number): void {
  if (state.paused === paused) return;
  if (paused) tick(state, now);
  state.last = now;
  state.paused = paused;
}

// One press by one pupil, either switch. Ignored unless the boost is live, so a press before GO is never queued and one after the finale starts is lost.
export function press(state: BoostState, player: number, now: number): BoostEvent[] {
  const events = tick(state, now);
  if (state.paused || state.phase !== 'live' || !(player >= 0 && player < state.players)) return events;
  state.energy = Math.min(state.target, state.energy + state.powers[player]);
  state.recent[player].push(state.clock);
  state.lastActive[player] = state.clock;
  events.push({ type: 'press', player });
  const reached = tierOf(state.energy, state.target);
  while (state.tier < reached) { state.tier = (state.tier + 1) as BoostTier; events.push({ type: 'tier', tier: state.tier }); }
  if (state.energy >= state.target) { state.phaseTime = 0; beginFinale(state, events); }
  return events;
}

// Teacher skip: ends the boost at once with no payoff.
export function skip(state: BoostState): BoostEvent[] {
  if (state.phase === 'done') return [];
  state.phase = 'done';
  state.phaseTime = 0;
  return [{ type: 'end', tier: state.finaleTier ?? finalTier(state) }];
}
