import type { Question, Side } from '../../game/questions';
import type { Turn } from '../../game/session';
import { icons, shapeMarker } from '../art/icons';
import { pilot, type PilotMood } from '../art/pilot';
import { idle, kill } from '../fx/motion';
import { createAnswerButton, type AnswerButton, type AnswerLook } from './answerButton';
import { objectsMarkup, starSize, zones, type Geo } from './objects';

export interface StationState { player: number; question: Question; outcome: Turn['outcome']; attempts: number; supported: boolean; picture: boolean; paused: boolean }
export interface StationParts { pilot: HTMLElement; objs: HTMLElement; buttons: [HTMLElement, HTMLElement] }
export interface Station { el: HTMLElement; parts: StationParts; mount(parent: HTMLElement): void; update(state: StationState): void; press(side: Side): void; destroy(): void }

const pillText = { right: 'Star sent!', passed: 'With the crew', helped: 'Count with me', tried: 'Try again' } as const;

export function createStation(slot: number, geo: Geo): Station {
  const el = document.createElement('section');
  el.className = 'sp-st';
  el.dataset.slot = String(slot);
  el.innerHTML = `<div class="sp-pilot"><div class="sp-bob"></div></div><span class="sp-shape" aria-hidden="true"></span><p class="sp-pill" hidden></p>
<p class="sp-prompt"></p><div class="sp-objs" role="img"></div>
<div class="sp-ans"></div>
<div class="sp-teach"><button type="button" class="sp-ghost" data-help>${icons.help(22)}</button><button type="button" class="sp-ghost" data-pass>${icons.pass(22)}</button></div>`;
  const crew = el.querySelector<HTMLElement>('.sp-pilot')!;
  const bob = el.querySelector<HTMLElement>('.sp-bob')!;
  const shape = el.querySelector<HTMLElement>('.sp-shape')!;
  const pill = el.querySelector<HTMLElement>('.sp-pill')!;
  const prompt = el.querySelector<HTMLElement>('.sp-prompt')!;
  const objs = el.querySelector<HTMLElement>('.sp-objs')!;
  const help = el.querySelector<HTMLButtonElement>('[data-help]')!;
  const pass = el.querySelector<HTMLButtonElement>('[data-pass]')!;
  const buttons: [AnswerButton, AnswerButton] = [createAnswerButton(0), createAnswerButton(1)];
  const answers = el.querySelector<HTMLElement>('.sp-ans')!;
  answers.insertAdjacentHTML('beforeend', `<span class="sp-chev sp-chev-l" aria-hidden="true">${icons.chevL()}</span>`);
  buttons.forEach(button => button.mount(answers));
  answers.insertAdjacentHTML('beforeend', `<span class="sp-chev sp-chev-r" aria-hidden="true">${icons.chevR()}</span>`);
  const bobbing = idle(bob, { y: -8, rotation: 2, duration: 1.7, delay: slot * 0.4 });
  let player = -1, mood: PilotMood | '' = '', question: Question | null = null;
  const set = (element: HTMLElement, name: string, value: string): void => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };

  return {
    el,
    parts: { pilot: crew, objs, buttons: [buttons[0].el, buttons[1].el] },
    mount(parent) { parent.append(el); },
    update(state) {
      const { question: q, outcome } = state;
      if (player !== state.player) {
        if (player >= 0) el.classList.remove(`sp-p${player}`);
        player = state.player; mood = '';
        el.classList.add(`sp-p${player}`);
        set(el, 'aria-label', `Player ${player + 1}`);
        shape.innerHTML = shapeMarker(player, 26);
        set(help, 'aria-label', `Help player ${player + 1}`); help.dataset.help = String(player);
        set(pass, 'aria-label', `Pass player ${player + 1}`); pass.dataset.pass = String(player);
      }
      if (question !== q) {
        question = q;
        const total = q.groups.reduce((a, b) => a + b, 0);
        prompt.textContent = q.kind === 'count' ? 'How many?' : `${q.groups.join(' + ')} = ?`;
        prompt.classList.toggle('is-eq', q.kind === 'add');
        objs.innerHTML = objectsMarkup(q.groups);
        objs.setAttribute('aria-label', `${q.groups.map(n => `${n} object${n === 1 ? '' : 's'}`).join(' plus ')}`);
        objs.style.setProperty('--s', `${starSize(q.groups, zones[geo])}px`);
        objs.dataset.total = String(total);
      }
      const tried = outcome === 'waiting' && state.attempts > 0;
      const wanted: PilotMood = outcome === 'correct' ? 'cheer' : outcome === 'passed' ? 'wave-right' : tried ? 'think' : 'idle';
      if (mood !== wanted) { mood = wanted; crew.dataset.mood = wanted; bob.innerHTML = pilot(player, wanted, 132); }
      const done = outcome !== 'waiting';
      el.classList.toggle('is-done', outcome === 'correct');
      el.classList.toggle('is-passed', outcome === 'passed');
      el.classList.toggle('is-helped', state.supported && !done);
      el.classList.toggle('is-live', !done);
      const note = outcome === 'correct' ? 'right' : outcome === 'passed' ? 'passed' : state.supported ? 'helped' : tried ? 'tried' : null;
      pill.hidden = !note;
      pill.textContent = note ? pillText[note] : '';
      pill.classList.toggle('gold', note === 'right');
      ([0, 1] as const).forEach(side => {
        const look: AnswerLook = outcome === 'correct' ? side === q.correct ? 'right' : 'dim' : outcome === 'passed' ? 'dim' : tried && side !== q.correct ? 'try' : state.paused ? 'idle' : 'ready';
        buttons[side].update({ player, value: q.choices[side], picture: state.picture && q.kind === 'add', look, disabled: done || state.paused });
      });
      help.disabled = pass.disabled = done || state.paused;
    },
    press(side) { buttons[side].press(); },
    destroy() { bobbing?.kill(); kill(bob); },
  };
}
