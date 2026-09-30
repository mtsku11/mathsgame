import { icons } from '../art/icons';
import { mothership } from '../art/mothership';
import { destinations, planetSvg } from '../art/planets';
import { pipSvg } from '../art/stars';
import type { Geo } from './objects';

export interface HubState { destination: number; round: number; completed: number; stars: number; ready: boolean; next: string | null; turn: string; slots: { player: number; done: boolean }[] }
export interface HubParts {
  ship: HTMLElement; total: SVGTextElement; halo: Element; pips: HTMLElement[]; centreX: number;
  hero: { box: HTMLElement; planet: HTMLElement; name: HTMLElement; size: number; rings: HTMLElement[]; card: HTMLElement; cardName: HTMLElement };
}
export interface Hub {
  parts: HubParts;
  mount(parent: HTMLElement): void;
  update(state: HubState): void;
  showDestination(destination: number): void;
  // The crew-star number lags the real total while stars are still flying to the core; the total is never derived from the animation.
  hold(count: number): void;
  release(count: number): void;
  releaseAll(): void;
}

interface Beam { slot: number; d: string }
// Beams run from each station's edge to the mothership: two per station in 1-2 player layouts, one per station in 3-4.
export function beamPaths(players: number, geo: Geo): Beam[] {
  const centre = geo === 1 ? 1080 : 640;
  const specs = geo === 4 ? Array.from({ length: players }, (_, slot) => ({ slot, right: slot % 2 === 1, top: slot < 2 }))
    : Array.from({ length: players * 2 }, (_, i) => ({ slot: Math.floor(i / 2), right: geo === 2 && i >= 2, top: i % 2 === 0 }));
  return specs.map(({ slot, right, top }) => {
    const dir = right ? -1 : 1, v = top ? 1 : -1;
    const sx = geo === 1 ? 920 : right ? 740 : 540, sy = top ? 236 : 566;
    const ex = centre - 28 * dir, ey = top ? 372 : 432;
    return { slot, d: `M${sx} ${sy} C ${sx + 50 * dir} ${sy + 14 * v} ${ex - 12 * dir} ${ey - 42 * v} ${ex} ${ey}` };
  });
}

export function createHub(options: { players: number; geo: Geo }): Hub {
  const { players, geo } = options;
  const left = geo === 1 ? 980 : 540;
  const wrap = document.createDocumentFragment();
  const beamList = beamPaths(players, geo);
  const beams = document.createElement('div');
  beams.innerHTML = `<svg class="sp-beams sp-deco" viewBox="0 0 1280 720" aria-hidden="true">${beamList.map(({ slot, d }) => `<path class="sp-beam" data-slot="${slot}" d="${d}"/>`).join('')}</svg>`;
  const beamSvg = beams.firstElementChild!;
  const paths = [...beamSvg.querySelectorAll<SVGPathElement>('.sp-beam')];
  const hub = document.createElement('section');
  hub.className = 'sp-hub';
  hub.setAttribute('aria-label', 'Journey progress');
  hub.style.left = `${left}px`;
  hub.innerHTML = `<div class="sp-dest"><span class="sp-dest-planet"></span><p class="sp-dest-name"></p></div>
<div class="sp-ship" role="img">${mothership(200)}</div>
<div class="sp-pips" aria-hidden="true">${Array.from({ length: 6 }, () => `<i class="sp-pip">${pipSvg()}</i>`).join('')}</div>
<p class="sp-round"></p><p class="sp-turn" hidden></p>
<button type="button" class="sp-next" data-action="next" hidden><span></span>${icons.arrow(20)}</button>`;
  const arrival = `<span class="sp-ring sp-deco"></span><span class="sp-ring sp-deco"></span><p class="sp-card" hidden><small>Welcome to</small><b></b></p>`;
  const hubDest = hub.querySelector<HTMLElement>('.sp-dest')!;
  const planet = hub.querySelector<HTMLElement>('.sp-dest-planet')!;
  const name = hub.querySelector<HTMLElement>('.sp-dest-name')!;
  const ship = hub.querySelector<HTMLElement>('.sp-ship')!;
  const total = hub.querySelector<SVGTextElement>('.sp-core-num')!;
  const pips = [...hub.querySelectorAll<HTMLElement>('.sp-pip')];
  const round = hub.querySelector<HTMLElement>('.sp-round')!;
  const turn = hub.querySelector<HTMLElement>('.sp-turn')!;
  const next = hub.querySelector<HTMLButtonElement>('.sp-next')!;
  const nextLabel = next.querySelector('span')!;
  let big: HTMLElement | null = null, bigPlanet: HTMLElement | null = null, bigName: HTMLElement | null = null, shown = -1, stars = 0, held = 0;
  if (players === 3) {
    big = document.createElement('div');
    big.className = 'sp-big';
    big.innerHTML = '<span class="sp-big-planet"></span><p class="sp-big-name"></p>';
    bigPlanet = big.querySelector('.sp-big-planet');
    bigName = big.querySelector('.sp-big-name');
  }
  const heroBox = big ?? hubDest;
  heroBox.insertAdjacentHTML('beforeend', arrival);
  const card = heroBox.querySelector<HTMLElement>('.sp-card')!;
  const showDestination = (destination: number): void => {
    if (shown === destination) return;
    shown = destination;
    const stop = destinations[destination];
    planet.innerHTML = planetSvg(stop.kind, 150);
    name.textContent = stop.name;
    name.style.color = stop.accent;
    if (big) { bigPlanet!.innerHTML = planetSvg(stop.kind, 250); bigName!.textContent = stop.name; bigName!.style.color = stop.accent; }
    card.querySelector('b')!.textContent = stop.name;
    heroBox.style.setProperty('--dc', stop.accent);
  };
  const showStars = (): void => {
    const text = String(Math.max(0, stars - held));
    if (total.textContent !== text) { total.textContent = text; total.setAttribute('font-size', text.length > 1 ? '46' : '56'); ship.setAttribute('aria-label', `Crew stars: ${text}`); }
  };
  wrap.append(beamSvg, hub);
  if (big) wrap.append(big);
  return {
    parts: {
      ship, total, halo: hub.querySelector('.sp-halo')!, pips, centreX: left + 100,
      hero: { box: heroBox, planet: bigPlanet ?? planet, name: bigName ?? name, size: big ? 230 : 150, rings: [...heroBox.querySelectorAll<HTMLElement>('.sp-ring')], card, cardName: card.querySelector('b')! },
    },
    mount(parent) { parent.append(wrap); },
    showDestination,
    hold(count) { held += count; },
    release(count) { held = Math.max(0, held - count); showStars(); },
    releaseAll() { held = 0; showStars(); },
    update(state) {
      showDestination(state.destination);
      stars = state.stars;
      showStars();
      pips.forEach((pip, i) => {
        pip.classList.toggle('is-done', i < state.completed);
        pip.classList.toggle('is-current', i === state.round - 1);
        pip.classList.toggle('is-earned', state.ready && i === state.round - 1);
      });
      round.textContent = `Round ${state.round} of 6`;
      turn.hidden = !state.turn;
      turn.textContent = state.turn;
      next.hidden = state.next === null;
      if (state.next !== null && nextLabel.textContent !== state.next) nextLabel.textContent = state.next;
      paths.forEach(path => {
        const target = state.slots[Number(path.dataset.slot)];
        if (target) path.setAttribute('class', `sp-beam sp-p${target.player}${target.done ? ' is-done' : ''}`);
      });
    },
  };
}
