import { gsap } from 'gsap';
import { starPath } from '../art/stars';
import { isCalm } from '../fx/motion';

export const METER_WIDTH = 750;
export interface PowerMeter { el: HTMLElement; stars: HTMLElement[]; mount(parent: HTMLElement): void; set(fraction: number): void; light(tier: number): void }

// The team's power bar with a star at one third, two thirds and full. The fill slides in from the left, so only transforms move; no numbers, no per-pupil marks.
export function createPowerMeter(): PowerMeter {
  const el = document.createElement('div');
  el.className = 'sp-meter';
  el.setAttribute('aria-hidden', 'true');
  const star = `<svg viewBox="0 0 44 44" width="44" height="44"><path d="${starPath(22, 23, 20, 8.5)}" stroke-width="3" stroke-linejoin="round"/></svg>`;
  el.innerHTML = `<div class="sp-meter-track"><div class="sp-meter-fill"></div></div>${[1 / 3, 2 / 3, 1].map(t => `<span class="sp-notch" style="left:${5 + METER_WIDTH * t}px"></span><span class="sp-tierstar" style="left:${5 + METER_WIDTH * t}px">${star}</span>`).join('')}`;
  const fill = el.querySelector<HTMLElement>('.sp-meter-fill')!;
  const stars = [...el.querySelectorAll<HTMLElement>('.sp-tierstar')];
  let shown = -1;
  gsap.set(fill, { x: -METER_WIDTH });
  return {
    el, stars,
    mount(parent) { parent.append(el); },
    set(fraction) {
      if (fraction === shown) return;
      shown = fraction;
      const x = -(1 - fraction) * METER_WIDTH;
      if (isCalm()) gsap.set(fill, { x }); else gsap.to(fill, { x, duration: 0.12, ease: 'power1.out', overwrite: 'auto' });
    },
    light(tier) { stars.forEach((star, i) => star.classList.toggle('is-lit', i < tier)); },
  };
}
