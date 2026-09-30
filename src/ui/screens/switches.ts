import '../pages.css';
import type { Screen } from '../../app/router';
import type { Side } from '../../game/questions';
import type { Binding } from '../../input/gamepad';
import type { Pair } from '../../input/normalize';
import { icons, shapeMarker } from '../art/icons';
import { pilot, pilotColors, type PilotMood } from '../art/pilot';
import { skyStars, starBadge } from '../art/stars';

export interface SwitchState {
  players: number;
  bindings: [Binding | null, Binding | null][];
  learning: [number, Side] | null;
  message: string;
  complete: boolean;
  recovering: boolean;
}
export interface SwitchScreen extends Screen {
  update(state: SwitchState): void;
  // Live press lights: which bound switches are down right now.
  lights(pressed: Pair[]): void;
  status(message: string): void;
  diagnostics(text: string): void;
}

const sides = ['Left', 'Right'] as const;
const moodOf = ([left, right]: Pair): PilotMood => left && right ? 'cheer' : left ? 'wave-left' : right ? 'wave-right' : 'idle';

export function createSwitchScreen(source: () => SwitchState): SwitchScreen {
  let root: HTMLElement | null = null;
  let slots: HTMLButtonElement[] = [];
  let pilots: HTMLElement[] = [];
  let moods: PilotMood[] = [];
  let lit: boolean[] = [];
  let wasBound: boolean[] = [];
  const find = <T extends HTMLElement>(selector: string): T => root!.querySelector<T>(selector)!;

  function markup(state: SwitchState): string {
    const cards = Array.from({ length: state.players }, (_, i) => `<section class="sw-card tp-p${i}" aria-labelledby="sw-h-${i}"><h2 id="sw-h-${i}"><i class="tp-shape">${shapeMarker(i, 22)}</i>Player ${i + 1}</h2><div class="sw-pilot" data-pilot="${i}">${pilot(i, 'idle', 150)}</div><p class="tp-foot">${pilotColors[i].name}</p>
<div class="sw-slots">${[0, 1].map(side => `<button type="button" class="map-button sw-slot" data-map-player="${i}" data-map-side="${side}"><span class="sw-cap"><span class="sw-led" aria-hidden="true"></span>${side ? icons.chevR(40) : icons.chevL(40)}</span><span class="sw-label"><span class="sr-only">Player ${i + 1} </span>${sides[side]} switch</span><strong class="sw-state"></strong><span class="sw-chip" aria-hidden="true"></span></button>`).join('')}</div></section>`).join('');
    return `<div class="tp" data-page="switches"><div class="tp-deco" aria-hidden="true">${skyStars(5).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ')}</div>
<header class="tp-bar"><div class="tp-brand">${starBadge(52)}<div><span class="tp-name">Number Crew</span><span class="tp-tag">Star Pilots · Switch setup</span></div></div></header>
<main class="tp-main"><button type="button" class="tp-btn tp-back" data-action="back"></button>
<div class="tp-intro"><h1>Match each switch to its pilot</h1>
<ol class="sw-steps"><li>Connect the Xbox Adaptive Controller by USB, or pair it in your computer’s Bluetooth settings.</li><li>Keep this page in front, then press and release a switch so the browser can find the controller.</li><li>Choose a switch below, then press and release the switch you want for it. Do one switch at a time.</li></ol>
<p class="sw-note">The controller is shared by ${state.players === 1 ? 'the player' : `all ${state.players} players`}. Use ${state.players * 2} different switches. Classroom hardware compatibility is still to be tested.</p></div>
<div class="sw-grid">${cards}</div>
<p id="calibration-status" class="sw-status" role="status"></p>
<div class="tp-actions"><button type="button" class="tp-btn" data-action="clear-bindings">Clear mappings</button><button type="button" class="tp-go" data-action="checkin">Start crew check-in <span aria-hidden="true">${icons.arrow(24)}</span></button></div>
<details open class="sw-diag"><summary>Live controller diagnostics</summary><pre id="diagnostic-text"></pre></details></main></div>`;
  }

  function set(element: HTMLElement, name: string, value: string): void { if (element.getAttribute(name) !== value) element.setAttribute(name, value); }
  function text(element: HTMLElement, value: string): void { if (element.textContent !== value) element.textContent = value; }

  return {
    mount(container) {
      const state = source();
      container.insertAdjacentHTML('beforeend', markup(state));
      root = container.querySelector<HTMLElement>('.tp[data-page="switches"]')!;
      slots = [...root.querySelectorAll<HTMLButtonElement>('.map-button')];
      pilots = [...root.querySelectorAll<HTMLElement>('[data-pilot]')];
      moods = pilots.map(() => 'idle');
      lit = slots.map(() => false);
      wasBound = slots.map(() => false);
      this.update(state);
      (slots.find(slot => !slot.classList.contains('is-bound')) ?? slots[0]).focus({ preventScroll: true });
    },
    update(state) {
      if (!root) return;
      const back = find<HTMLButtonElement>('.tp-back');
      const action = state.recovering ? 'pause-back' : 'setup';
      set(back, 'data-action', action);
      text(back, state.recovering ? '← Back to paused game' : '← Teacher setup');
      let justBound = -1;
      slots.forEach((slot, n) => {
        const player = Number(slot.dataset.mapPlayer), side = Number(slot.dataset.mapSide);
        const binding = state.bindings[player][side];
        const learning = state.learning?.[0] === player && state.learning[1] === side;
        slot.classList.toggle('is-bound', !!binding);
        slot.classList.toggle('is-learning', learning);
        slot.classList.toggle('learning', learning);
        text(slot.querySelector<HTMLElement>('.sw-state')!, binding ? `Button ${binding.button} · checked` : learning ? 'Press and release it' : 'Learn switch');
        if (binding && !wasBound[n]) justBound = n;
        wasBound[n] = !!binding;
      });
      text(find('#calibration-status'), state.message);
      const start = find<HTMLButtonElement>('[data-action="checkin"]');
      if (start.disabled === state.complete) start.disabled = !state.complete;
      if (justBound >= 0 && (document.activeElement === slots[justBound] || document.activeElement === document.body)) {
        (slots.find(slot => !slot.classList.contains('is-bound')) ?? (state.complete ? start : slots[justBound])).focus({ preventScroll: true });
      }
    },
    lights(pressed) {
      if (!root) return;
      slots.forEach((slot, n) => {
        const player = Number(slot.dataset.mapPlayer), side = Number(slot.dataset.mapSide);
        const on = !!pressed[player]?.[side] && slot.classList.contains('is-bound');
        if (lit[n] === on) return;
        lit[n] = on;
        slot.classList.toggle('is-on', on);
        text(slot.querySelector<HTMLElement>('.sw-chip')!, on ? 'PRESSED' : '');
      });
      pilots.forEach((holder, player) => {
        const mood = moodOf([lit[player * 2], lit[player * 2 + 1]]);
        if (moods[player] !== mood) { moods[player] = mood; holder.innerHTML = pilot(player, mood, 150); }
      });
    },
    status(message) { if (root) text(find('#calibration-status'), message); },
    diagnostics(value) { if (root) text(find('#diagnostic-text'), value); },
    unmount() { root = null; slots = []; pilots = []; },
  };
}
