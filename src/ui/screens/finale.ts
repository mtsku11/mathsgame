import '../finale.css';
import { gsap } from 'gsap';
import type { Screen } from '../../app/router';
import type { Quality } from '../../settings';
import { icons } from '../art/icons';
import { mothership } from '../art/mothership';
import { pilot, pilotColors } from '../art/pilot';
import { destinations, planetSvg } from '../art/planets';
import { pipSvg, skyStars, starPath } from '../art/stars';
import { idle, isCalm, timeline } from '../fx/motion';
import { burst, confetti, crewColours, detachParticles, attachParticles, rain } from '../fx/particles';
import { destroyFx, initFx, particleResolution, resolveQuality } from '../fx/pixi';
import { createStage, type Stage } from '../stage';

// Session-only counts per pilot. No ranking, no timing and no boost presses.
export interface SummaryRow { player: number; correct: number; tries: number; help: number; passed: number }
export interface FinaleState { players: number; stars: number; rows: SummaryRow[]; offline: string; canUpdate: boolean }
export interface FinaleScreen extends Screen { update(state: FinaleState): void }

// Pilot centres on the 1280x720 stage; seating order (left to right, top to bottom) matches the play screen.
const seats: Record<number, [number, number][]> = {
  1: [[330, 430]],
  2: [[330, 430], [950, 430]],
  3: [[300, 310], [980, 310], [330, 510]],
  4: [[300, 310], [980, 310], [330, 510], [950, 510]],
};
const PILOT = 190;

export function createFinaleScreen(source: () => FinaleState, options: { quality: Quality }): FinaleScreen {
  let stage: Stage | null = null;
  let root: HTMLElement | null = null;
  let context: ReturnType<typeof gsap.context> | null = null;
  const view = (): HTMLElement => root!;

  function summary(rows: SummaryRow[]): string {
    return `<p>Two choices include a chance element. This is observation, not an attainment score. Tries are answers that were not right yet; help means the count-together helper was used.</p><table><thead><tr><th scope="col">Pilot</th><th scope="col">Correct</th><th scope="col">Tries</th><th scope="col">Help</th><th scope="col">Passed</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">Player ${row.player}<span class="sp-fin-colour"> · ${pilotColors[row.player - 1].name}</span></th><td>${row.correct}</td><td>${row.tries}</td><td>${row.help}</td><td>${row.passed}</td></tr>`).join('')}</tbody></table><p>Results disappear when you start again. No pupil data is saved.</p>`;
  }

  function markup(state: FinaleState): string {
    const pilots = seats[state.players].map(([x, y], i) => `<div class="sp-fin-pilot" style="left:${x - PILOT / 2}px;top:${y - PILOT * 0.44}px;width:${PILOT}px"><div class="sp-fin-bob">${pilot(i, 'cheer', PILOT)}</div></div>`).join('');
    return `<div class="sp-space sp-deco" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(7)}</div>
<main class="sp-fin">
<p class="sp-fin-status"><span class="sp-fin-dot" aria-hidden="true"></span><span id="offline-status"></span></p>
<button type="button" class="sp-fin-update" data-action="update" hidden>Update game now</button>
<h1 class="sp-fin-title" tabindex="-1">Mission complete!</h1>
<p class="sp-fin-stars">✦ ${state.stars} crew stars collected</p>
<ol class="sp-fin-route" aria-label="Journey route">${destinations.map(stop => `<li style="--dc:${stop.accent}">${planetSvg(stop.kind, 56)}<svg class="sp-fin-vstar" viewBox="0 0 20 20" aria-hidden="true"><path d="${starPath(10, 10.5, 8, 3.4)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="2" stroke-linejoin="round"/></svg><span>${stop.name}<span class="sr-only">, visited</span></span></li>`).join('')}</ol>
<div class="sp-fin-ship" role="img" aria-label="Crew stars: ${state.stars}">${mothership(300)}</div>
<div class="sp-fin-pips" aria-hidden="true">${Array.from({ length: 6 }, () => `<i class="sp-pip is-done">${pipSvg()}</i>`).join('')}</div>
${pilots}
<div class="sp-fin-actions"><button type="button" class="sp-fin-primary" data-action="replay">Another adventure ${icons.arrow(24)}</button><button type="button" class="sp-fin-secondary" data-action="setup">New session</button></div>
<details class="sp-fin-summary"><summary>Teacher observation · this session only</summary><div class="sp-fin-summary-body">${summary(state.rows)}</div></details>
</main>`;
  }

  function play(state: FinaleState): void {
    const el = view();
    const total = el.querySelector<SVGTextElement>('.sp-core-num')!;
    const setTotal = (value: number): void => { total.textContent = String(value); total.setAttribute('font-size', String(value).length > 1 ? '46' : '56'); };
    const finish = (): void => setTotal(state.stars);
    if (isCalm()) { finish(); return; }
    setTotal(0);
    const title = el.querySelector('.sp-fin-title')!, stars = el.querySelector('.sp-fin-stars')!, route = el.querySelector('.sp-fin-route')!;
    const ship = el.querySelector('.sp-fin-ship')!, pips = [...el.querySelectorAll('.sp-pip')], actions = el.querySelector('.sp-fin-actions')!;
    const bobs = [...el.querySelectorAll('.sp-fin-bob')], seat = [...el.querySelectorAll('.sp-fin-pilot')];
    gsap.set([title, stars, route, ship, ...seat, ...pips, actions], { opacity: 0 });
    gsap.set(title, { y: -150 });
    gsap.set(ship, { scale: 0.5, transformOrigin: '50% 50%' });
    gsap.set(seat, { y: 140, scale: 0.6, transformOrigin: '50% 100%' });
    const count = { value: 0 };
    const seconds = Math.min(2.2, 0.5 + state.stars * 0.07);
    timeline()
      .to(title, { y: 0, opacity: 1, duration: 0.85, ease: 'bounce.out' }, 0)
      .to(ship, { scale: 1, opacity: 1, duration: 0.75, ease: 'back.out(1.7)' }, 0.15)
      .to(seat, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)', stagger: 0.14 }, 0.45)
      .to(count, { value: state.stars, duration: seconds, ease: 'power1.inOut', onUpdate: () => setTotal(Math.round(count.value)) }, 0.7)
      .to(pips, { opacity: 1, duration: 0.3, stagger: 0.09 }, 0.9)
      .to(route, { opacity: 1, duration: 0.5 }, 1.1)
      .to(stars, { opacity: 1, duration: 0.5 }, 1.2)
      .to(actions, { opacity: 1, duration: 0.4 }, 1.4)
      .to(ship, { keyframes: [{ scale: 1.14, duration: 0.14, ease: 'power2.out' }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.45)' }] }, 0.7 + seconds)
      .call(() => { const at = { x: 640, y: 390 }; burst(at.x, at.y, { count: 60, size: [16, 32], speed: [240, 520], life: [0.8, 1.3], colours: [0xFFD23F, 0xFFE58A, 0xFFFFFF, ...crewColours] }); }, [], 0.7 + seconds);
    bobs.forEach((bob, i) => idle(bob, { y: -16, rotation: i % 2 ? 5 : -5, duration: 0.42 + i * 0.04, delay: 1.1 + i * 0.09 }));
    idle(ship, { y: -8, duration: 2.2 });
  }

  function showers(): void {
    confetti({ x: 0, width: 1280, y: -30, count: 150, duration: 1.9, life: [1.6, 2.1] });
    rain({ x: 200, width: 880, y: -30, count: 40, duration: 1.6, life: [1.6, 2.1] });
    context?.add(() => [[300, 260], [980, 260]].forEach(([x, y], i) => gsap.delayedCall(0.5 + i * 0.32, () => burst(x, y, { count: 34, size: [14, 28], speed: [200, 440], life: [0.7, 1.2], colours: crewColours }))));
  }

  function apply(state: FinaleState): void {
    const el = view();
    el.querySelector('#offline-status')!.textContent = state.offline;
    el.querySelector<HTMLElement>('.sp-fin-update')!.hidden = !state.canUpdate;
  }

  return {
    mount(container) {
      const state = source();
      stage = createStage(container);
      stage.element.innerHTML = markup(state);
      root = stage.element;
      apply(state);
      root.querySelector<HTMLElement>('.sp-fin-title')!.focus({ preventScroll: true });
      context = gsap.context(() => play(state));
      void initFx(options.quality, { maxResolution: particleResolution(), antialias: false }).then(app => app ? attachParticles(app, resolveQuality(options.quality)).then(() => { if (root) showers(); }) : undefined);
    },
    update(state) { if (root) apply(state); },
    unmount() {
      context?.kill();
      context = null;
      detachParticles();
      destroyFx();
      stage?.destroy();
      stage = null;
      root = null;
    },
  };
}
