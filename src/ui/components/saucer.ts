import { gsap } from 'gsap';
import { pilot, type PilotMood } from '../art/pilot';
import { isCalm } from '../fx/motion';

export const SAUCER_WIDTH = 150;
export const SAUCER_TOP = 581;
export interface Saucer {
  el: HTMLElement; button: HTMLButtonElement; pilot: HTMLElement; player: number;
  centre: { x: number; y: number };
  mount(parent: HTMLElement): void;
  setMood(mood: PilotMood): void;
  setHeat(heat: number): void;
  squash(): void;
  wiggle(): void;
  cheer(): void;
}

// Pilots sit in a row along the bottom, evenly spaced for one to four players.
const rows: Record<number, number[]> = { 1: [640], 2: [440, 840], 3: [300, 640, 980], 4: [200, 490, 790, 1080] };
export const saucerCentres = (players: number): number[] => rows[players] ?? rows[4];

// One pilot's saucer for the boost round: a native button (touch, mouse and keyboard reach the same press path as a switch) with a glow under it that follows that pupil's recent press rate.
export function createSaucer(player: number, x: number): Saucer {
  const el = document.createElement('div');
  el.className = `sp-bsaucer sp-p${player}`;
  el.style.left = `${x - SAUCER_WIDTH / 2}px`;
  el.dataset.player = String(player);
  el.innerHTML = `<span class="sp-bheat"></span><button type="button" class="sp-bsaucer-btn" aria-label="Boost player ${player + 1}" data-boost-player="${player}"><span class="sp-bjig"><span class="sp-bpilot"></span></span></button>`;
  const button = el.querySelector<HTMLButtonElement>('button')!;
  const body = el.querySelector<HTMLElement>('.sp-bpilot')!;
  const heat = el.querySelector<HTMLElement>('.sp-bheat')!;
  let mood: PilotMood | '' = '', shownHeat = -1;
  const setMood = (next: PilotMood): void => { if (mood !== next) { mood = next; body.innerHTML = pilot(player, next, SAUCER_WIDTH); } };
  setMood('idle');
  gsap.set(body, { transformOrigin: '50% 100%' });
  return {
    el, button, pilot: body, player, centre: { x, y: SAUCER_TOP + 40 },
    mount(parent) { parent.append(el); },
    setMood,
    setHeat(value) {
      const rounded = Math.round(value * 50) / 50;
      if (rounded === shownHeat) return;
      shownHeat = rounded;
      heat.style.opacity = String(0.28 + 0.72 * rounded);
      heat.style.transform = `scale(${(0.85 + 0.4 * rounded).toFixed(3)})`;
    },
    squash() {
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(body, { scaleX: 1.12, scaleY: 0.86, duration: 0.03, ease: 'power1.out' })
        .to(body, { scaleX: 0.96, scaleY: 1.07, y: -8, duration: 0.05, ease: 'power1.out' })
        .to(body, { scaleX: 1, scaleY: 1, y: 0, duration: 0.09, ease: 'power2.in', clearProps: 'transform' });
    },
    wiggle() {
      if (isCalm()) return;
      gsap.fromTo(body, { rotation: 0 }, { keyframes: [{ rotation: -6, duration: 0.1 }, { rotation: 6, duration: 0.14 }, { rotation: -4, duration: 0.12 }, { rotation: 0, duration: 0.14 }], overwrite: 'auto', clearProps: 'transform' });
    },
    cheer() {
      if (isCalm()) return;
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(body, { y: -26, scaleX: 0.95, scaleY: 1.07, duration: 0.16, ease: 'power2.out' })
        .to(body, { y: 0, scaleX: 1.06, scaleY: 0.92, duration: 0.14, ease: 'power2.in' })
        .to(body, { y: -12, scaleX: 1, scaleY: 1, duration: 0.12, ease: 'power2.out' })
        .to(body, { y: 0, duration: 0.3, ease: 'bounce.out', clearProps: 'transform' });
    },
  };
}
