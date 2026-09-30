import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

declare global { interface Window { __NC_TEST__?: boolean } }

const query = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = query.matches;
let lowStim = false;
const instant = window.__NC_TEST__ === true || new URLSearchParams(location.search).has('instant');
const root = document.documentElement;
const sync = (): void => {
  root.classList.toggle('nc-reduced', reduced);
  root.classList.toggle('nc-lowstim', lowStim);
  root.classList.toggle('nc-instant', instant);
};
// Instant mode (?instant or window.__NC_TEST__ set before load) runs the global GSAP clock at 1000x, so every tween and timeline, however it was built, completes within the first frame; looping idles are not created.
if (instant) gsap.globalTimeline.timeScale(1000);
query.addEventListener('change', event => { reduced = event.matches; sync(); });
sync();

export const isInstant = (): boolean => instant;
export const isReduced = (): boolean => reduced;
export const isLowStim = (): boolean => lowStim;
export const isCalm = (): boolean => instant || reduced || lowStim;
export function setReducedMotion(value: boolean): void { reduced = value; sync(); }
export function setLowStim(value: boolean): void { lowStim = value; sync(); }

const snap = (vars: gsap.TweenVars): gsap.TweenVars => reduced ? { ...vars, duration: 0, delay: 0, stagger: 0 } : vars;
export const set = (target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween => gsap.set(target, vars);
export const to = (target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween => gsap.to(target, snap(vars));
export const from = (target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween => gsap.from(target, snap(vars));
export const fromTo = (target: gsap.TweenTarget, start: gsap.TweenVars, end: gsap.TweenVars): gsap.core.Tween => gsap.fromTo(target, start, snap(end));
export function timeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
  const tl = gsap.timeline(vars);
  if (reduced) tl.timeScale(1000);
  return tl;
}
// Low power runs every other looping idle, which halves the ambient animation.
let idles = 0;
export function idle(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween | null {
  if (!isCalm() && root.classList.contains('nc-lowpower') && idles++ % 2) return null;
  return isCalm() ? null : gsap.to(target, { repeat: -1, yoyo: true, ease: 'sine.inOut', ...vars });
}
export const kill = (target: gsap.TweenTarget): void => { gsap.killTweensOf(target); };
// Real-time hold that ignores reduced-motion snapping (a card that must stay readable) but still collapses in instant mode.
export const after = (seconds: number, run: () => void): gsap.core.Tween => gsap.delayedCall(seconds, run);
// Top-level tweens and timelines still alive on the global clock; zero once every moment has finished (looping idles count).
export const runningMotion = (): number => gsap.globalTimeline.getChildren(false, true, true).length;
