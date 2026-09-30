import { icons } from '../art/icons';
import { destinations, planetSvg } from '../art/planets';
import { starBadge, starPath } from '../art/stars';

export interface HudState { destination: number }
export interface Hud { el: HTMLElement; stops: HTMLElement[]; mount(parent: HTMLElement): void; update(state: HudState): void }

export function createHud(): Hud {
  const el = document.createElement('header');
  el.className = 'sp-hud';
  el.innerHTML = `<div class="sp-logo">${starBadge(48)}<div><b>Number Crew</b><small>Star Pilots</small></div></div>
<ol class="sp-route" aria-label="Journey route">${destinations.map((stop, i) => `<li class="sp-stop" style="--dc:${stop.accent};--i:${i}">${planetSvg(stop.kind, 60)}<svg class="sp-vstar" viewBox="0 0 20 20" aria-hidden="true"><path d="${starPath(10, 10.5, 8, 3.4)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="2" stroke-linejoin="round"/></svg><span class="sr-only"></span></li>`).join('')}</ol>
<button type="button" class="sp-pause" data-action="pause" aria-label="Pause game">${icons.pause(24)}</button>`;
  const stops = [...el.querySelectorAll<HTMLElement>('.sp-stop')];
  return {
    el, stops,
    mount(parent) { parent.append(el); },
    update({ destination }) {
      stops.forEach((stop, i) => {
        const phase = i < destination ? 'visited' : i === destination ? 'current' : 'future';
        stop.className = `sp-stop is-${phase}`;
        if (i === destination) stop.setAttribute('aria-current', 'step'); else stop.removeAttribute('aria-current');
        stop.querySelector('.sr-only')!.textContent = `${destinations[i].name}, ${phase === 'visited' ? 'visited' : phase === 'current' ? 'current destination' : 'still to visit'}`;
      });
    },
  };
}
