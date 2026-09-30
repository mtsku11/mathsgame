import '../checkin.css';
import { gsap } from 'gsap';
import type { Screen } from '../../app/router';
import type { Pair } from '../../input/normalize';
import { paintCap, type CapColour } from '../art/caps';
import { icons, shapeMarker } from '../art/icons';
import { pilot, pilotColors, type PilotMood } from '../art/pilot';
import { skyStars } from '../art/stars';
import { idle, isCalm, kill } from '../fx/motion';
import { createStage, type Stage } from '../stage';

export interface CheckInState {
  players: number;
  mode: 'controller' | 'keyboard';
  // The key letters shown under each switch in keyboard mode.
  keys: [string, string][];
  caps: [CapColour, CapColour][];
  // Pressed at least once (the pose follows this) and pressed then released (the switch is checked).
  touched: Pair[];
  checked: Pair[];
  recovering: boolean;
}
export interface CheckInScreen extends Screen { update(state: CheckInState): void }

const sideNames = ['Left', 'Right'] as const;
const PILOT_WIDTH: Record<number, number> = { 1: 330, 2: 330, 3: 290, 4: 204 };

export function createCheckInScreen(source: () => CheckInState): CheckInScreen {
  let stage: Stage | null = null;
  let root: HTMLElement | null = null;
  let cards: HTMLElement[] = [];
  let bobs: HTMLElement[] = [];
  let moods: (PilotMood | '')[] = [];
  let ready: boolean[] = [];
  let width = 0;
  const find = <T extends HTMLElement>(selector: string): T => root!.querySelector<T>(selector)!;
  const set = (element: HTMLElement, name: string, value: string): void => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };
  const text = (element: HTMLElement, value: string): void => { if (element.textContent !== value) element.textContent = value; };

  function markup(state: CheckInState): string {
    const cardsHtml = Array.from({ length: state.players }, (_, i) => `<section class="ck-card sp-p${i}" data-player="${i}" aria-labelledby="ck-h-${i}">
<h2 id="ck-h-${i}"><i class="ck-shape">${shapeMarker(i, 26)}</i>Player ${i + 1}<span>${pilotColors[i].name}</span></h2>
<div class="ck-pilot"><div class="ck-float"><div class="ck-bob"></div></div></div>
<p class="ck-pill"></p>
<div class="ck-caps">${[0, 1].map(side => `<div class="ck-slot"><button type="button" class="sp-btn ck-cap is-ready" data-answer-player="${i}" data-answer-side="${side}"><span class="sp-val">${side ? icons.chevR(46) : icons.chevL(46)}</span><span class="sp-tick">${icons.tick(28)}</span></button><span class="ck-key">${sideNames[side]}${state.mode === 'keyboard' ? ` · ${state.keys[i][side].slice(3)}` : ''}</span></div>`).join('')}</div></section>`).join('');
    return `<div class="sp-space sp-deco" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(9)}</div>
<main class="ck ck-n${state.players}"><header class="ck-head"><h1 tabindex="-1">Crew check!</h1><p>Press your left switch, then your right switch, to wake up your pilot.</p></header>
<div class="ck-row">${cardsHtml}</div>
<footer class="ck-teacher"><p class="ck-count" id="ck-count"></p><div class="ck-buttons"><button type="button" class="ck-btn ck-back"></button><button type="button" class="ck-btn" data-action="start-anyway">Start anyway</button><button type="button" class="ck-go" data-action="start">Start mission</button></div><p class="ck-tip">Teacher: Enter or N starts the mission once every pilot is ready.</p></footer></main>`;
  }

  function wave(bob: HTMLElement): void {
    if (isCalm()) return;
    gsap.fromTo(bob, { scale: 0.86, y: 14 }, { scale: 1, y: 0, duration: 0.5, ease: 'back.out(3)', overwrite: 'auto', clearProps: 'transform' });
  }
  function wake(bob: HTMLElement): void {
    if (isCalm()) return;
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(bob, { y: -30, scaleX: 0.95, scaleY: 1.08, duration: 0.18, ease: 'power2.out' })
      .to(bob, { y: 0, scaleX: 1.07, scaleY: 0.92, duration: 0.14, ease: 'power2.in' })
      .to(bob, { y: -12, scaleX: 1, scaleY: 1, duration: 0.12, ease: 'power2.out' })
      .to(bob, { y: 0, duration: 0.3, ease: 'bounce.out', clearProps: 'transform' });
  }

  return {
    mount(container) {
      const state = source();
      width = PILOT_WIDTH[state.players];
      stage = createStage(container);
      stage.element.innerHTML = markup(state);
      root = stage.element;
      cards = [...root.querySelectorAll<HTMLElement>('.ck-card')];
      bobs = cards.map(card => card.querySelector<HTMLElement>('.ck-bob')!);
      moods = cards.map(() => '');
      ready = cards.map(() => false);
      bobs.forEach((bob, i) => idle(bob.parentElement!, { y: -6, duration: 2.6, delay: i * 0.3 }));
      this.update(state);
      find('.ck h1').focus({ preventScroll: true });
    },
    update(state) {
      if (!root) return;
      let done = 0;
      cards.forEach((card, i) => {
        const [leftTouched, rightTouched] = state.touched[i];
        const [leftChecked, rightChecked] = state.checked[i];
        const allChecked = leftChecked && rightChecked;
        if (allChecked) done++;
        const mood: PilotMood = allChecked ? 'cheer' : rightTouched && !leftTouched ? 'wave-right' : leftTouched && !rightTouched ? 'wave-left' : leftTouched && rightTouched ? (moods[i] === 'wave-left' ? 'wave-left' : 'wave-right') : 'sleep';
        if (moods[i] !== mood) {
          moods[i] = mood;
          bobs[i].innerHTML = pilot(i, mood, width);
          if (mood === 'wave-left' || mood === 'wave-right') wave(bobs[i]);
        }
        if (allChecked && !ready[i]) wake(bobs[i]);
        ready[i] = allChecked;
        card.classList.toggle('is-ready', allChecked);
        card.classList.toggle('is-awake', leftTouched || rightTouched);
        text(card.querySelector<HTMLElement>('.ck-pill')!, allChecked ? 'Ready!' : leftChecked || rightChecked ? (leftChecked ? 'Now the right switch' : 'Now the left switch') : leftTouched || rightTouched ? 'Hello!' : 'Sleeping… press one');
        card.querySelectorAll<HTMLButtonElement>('.ck-cap').forEach(cap => {
          const side = Number(cap.dataset.answerSide);
          const isChecked = state.checked[i][side], isTouched = state.touched[i][side];
          paintCap(cap, state.caps[i][side]);
          cap.classList.toggle('is-right', isChecked);
          cap.classList.toggle('is-pressed', isTouched && !isChecked);
          cap.classList.toggle('is-ready', !isTouched && !isChecked);
          set(cap, 'aria-label', `Player ${i + 1}, ${sideNames[side].toLowerCase()} switch${isChecked ? ', checked' : ''}`);
        });
      });
      text(find('#ck-count'), `${done} of ${state.players} pilots ready`);
      const go = find<HTMLButtonElement>('[data-action="start"]');
      text(go, state.recovering ? 'Resume journey' : 'Start mission');
      go.disabled = done < state.players;
      const anyway = find<HTMLButtonElement>('[data-action="start-anyway"]');
      anyway.hidden = state.recovering || done === state.players;
      const back = find<HTMLButtonElement>('.ck-back');
      set(back, 'data-action', state.mode === 'controller' ? 'controls' : 'setup');
      text(back, state.mode === 'controller' ? 'Switch setup' : 'Back to setup');
    },
    unmount() {
      bobs.forEach(bob => { kill(bob); kill(bob.parentElement!); });
      bobs = [];
      stage?.destroy();
      stage = null;
      root = null;
    },
  };
}
