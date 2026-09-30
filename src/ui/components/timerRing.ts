export interface TimerRing { el: SVGSVGElement; mount(parent: HTMLElement): void; set(fraction: number): void }

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A slim ring for the time left in the live phase. It only ever shows a shape; there are no digits to read or race.
export function createTimerRing(): TimerRing {
  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="sp-timer" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true"><circle cx="36" cy="36" r="${RADIUS}" fill="#0C0830" stroke="#2B1E86" stroke-width="8"/><circle class="sp-timer-arc" cx="36" cy="36" r="${RADIUS}" fill="none" stroke="#36D6FF" stroke-width="8" stroke-linecap="round" stroke-dasharray="${CIRCUMFERENCE.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}" transform="rotate(-90 36 36)"/></svg>`;
  const el = holder.firstElementChild as SVGSVGElement;
  const arc = el.querySelector<SVGCircleElement>('.sp-timer-arc')!;
  let shown = -1;
  return {
    el,
    mount(parent) { parent.append(el); },
    set(fraction) {
      const value = Math.round(Math.max(0, Math.min(1, fraction)) * 200) / 200;
      if (value === shown) return;
      shown = value;
      arc.setAttribute('stroke-dasharray', `${(CIRCUMFERENCE * value).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`);
    },
  };
}
