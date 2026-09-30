import { shapeMarker } from '../art/icons';
import { pilot, pilotColors } from '../art/pilot';
import { from, isCalm, kill } from '../fx/motion';

export interface RestState { player: number; done: boolean }
export interface Rests { el: HTMLElement; mount(parent: HTMLElement): void; update(rest: RestState[]): void }

// Spotlight: the pupils who are not taking the turn rest small at the screen edge. They show no answer buttons and take no input.
export function createRests(): Rests {
  const el = document.createElement('div');
  el.className = 'sp-rests';
  let shown = '';
  return {
    el,
    mount(parent) { parent.append(el); },
    update(rest) {
      const key = rest.map(({ player, done }) => `${player}${done ? 'd' : 'w'}`).join();
      if (key === shown) return;
      const first = shown === '';
      shown = key;
      [...el.children].forEach(child => kill(child));
      el.innerHTML = rest.map(({ player, done }) => `<div class="sp-rest sp-p${player}${done ? ' is-done' : ''}" role="img" aria-label="Player ${player + 1}, ${done ? 'finished' : 'waiting'}">
<div class="sp-rest-pilot">${pilot(player, done ? 'idle' : 'sleep', 96)}</div><p class="sp-rest-name"><i aria-hidden="true">${shapeMarker(player, 16)}</i>${pilotColors[player].name.split(' ')[0]}</p></div>`).join('');
      if (!first && !isCalm()) from([...el.children], { opacity: 0, x: -24, scale: 0.8, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.08, clearProps: 'opacity,transform' });
    },
  };
}
