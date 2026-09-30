import type { Side } from '../../game/questions';
import { icons } from '../art/icons';
import { paintCap, type CapColour } from '../art/caps';
import { burstSvg, starCluster } from '../art/stars';

export type AnswerLook = 'ready' | 'right' | 'dim' | 'try' | 'idle';
export interface AnswerState { player: number; value: number; picture: boolean; look: AnswerLook; disabled: boolean; cap: CapColour }
export interface AnswerButton { el: HTMLButtonElement; mount(parent: HTMLElement): void; update(state: AnswerState): void; press(): void }

export function createAnswerButton(side: Side): AnswerButton {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'sp-btn';
  el.dataset.answerSide = String(side);
  el.innerHTML = `<span class="sp-val"></span>${burstSvg()}<span class="sp-tick">${icons.tick(28)}</span>`;
  const value = el.querySelector<HTMLElement>('.sp-val')!;
  let shown = '', timer = 0;
  return {
    el,
    mount(parent) { parent.append(el); },
    update(state) {
      el.dataset.answerPlayer = String(state.player);
      paintCap(el, state.cap);
      const label = `Player ${state.player + 1}, ${side ? 'right' : 'left'} answer, ${state.value}`;
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      const key = `${state.picture ? 'p' : 'n'}${state.value}`;
      if (key !== shown) { shown = key; value.innerHTML = state.picture ? starCluster(state.value) : String(state.value); }
      el.classList.toggle('is-ready', state.look === 'ready');
      el.classList.toggle('is-right', state.look === 'right');
      el.classList.toggle('is-dim', state.look === 'dim');
      el.classList.toggle('is-try', state.look === 'try');
      if (el.disabled !== state.disabled) el.disabled = state.disabled;
    },
    press() {
      clearTimeout(timer);
      el.classList.add('is-pressed');
      timer = window.setTimeout(() => el.classList.remove('is-pressed'), 140);
    },
  };
}
