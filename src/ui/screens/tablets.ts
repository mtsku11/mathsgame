import '../pages.css';
import { renderSVG } from 'uqr';
import type { Screen } from '../../app/router';
import type { Pair } from '../../input/normalize';
import { icons, shapeMarker } from '../art/icons';
import { paintCap, type CapColour } from '../art/caps';
import { pilot, type PilotMood } from '../art/pilot';
import { skyStars, starBadge } from '../art/stars';

export interface TabletState {
  players: number;
  room: string;
  // Each player's tablet link, and the page address a teacher can type instead of scanning.
  links: string[];
  page: string;
  connected: boolean[];
  online: boolean;
  replaced: boolean;
  caps: [CapColour, CapColour][];
}
export interface TabletScreen extends Screen {
  update(state: TabletState): void;
  lights(pressed: Pair[]): void;
}

const sides = ['Left', 'Right'] as const;
const moodOf = ([left, right]: Pair): PilotMood => left && right ? 'cheer' : left ? 'wave-left' : right ? 'wave-right' : 'idle';
export const spacedRoom = (room: string): string => `${room.slice(0, 4)} ${room.slice(4)}`;

export function createTabletScreen(source: () => TabletState): TabletScreen {
  let root: HTMLElement | null = null;
  let slots: HTMLElement[] = [];
  let pilots: HTMLElement[] = [];
  let moods: PilotMood[] = [];
  let lit: boolean[] = [];
  const find = <T extends HTMLElement>(selector: string): T => root!.querySelector<T>(selector)!;
  const text = (element: HTMLElement, value: string): void => { if (element.textContent !== value) element.textContent = value; };

  function markup(state: TabletState): string {
    const cards = Array.from({ length: state.players }, (_, i) => `<section class="sw-card tb-card tp-p${i}" aria-labelledby="tb-h-${i}"><h2 id="tb-h-${i}"><i class="tp-shape">${shapeMarker(i, 22)}</i>Player ${i + 1}</h2>
<div class="tb-qr" role="img" aria-label="Code to scan with Player ${i + 1}’s tablet" data-link="${state.links[i]}">${renderSVG(state.links[i], { ecc: 'M', border: 2 })}</div>
<div class="tb-who"><div class="sw-pilot" data-pilot="${i}">${pilot(i, 'idle', 84)}</div><p class="tb-state" data-tablet="${i}"></p></div>
<div class="sw-slots">${[0, 1].map(side => `<div class="sw-slot tb-slot" data-tablet-player="${i}" data-tablet-side="${side}"><span class="sw-cap"><span class="sw-led" aria-hidden="true"></span>${side ? icons.chevR(40) : icons.chevL(40)}</span><span class="sw-label">${sides[side]} button</span><span class="sw-chip" aria-hidden="true"></span></div>`).join('')}</div></section>`).join('');
    return `<div class="tp" data-page="tablets"><div class="tp-deco" aria-hidden="true">${skyStars(5).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ')}</div>
<header class="tp-bar"><div class="tp-brand">${starBadge(52)}<div><span class="tp-name">Number Crew</span><span class="tp-tag">Star Pilots · Tablet setup</span></div></div></header>
<main class="tp-main"><button type="button" class="tp-btn tp-back" data-action="setup">← Teacher setup</button>
<div class="tp-intro"><h1>Connect a tablet for each pilot</h1>
<ol class="sw-steps"><li>Connect this computer and every tablet to the internet.</li><li>On each tablet, scan that player’s code below with the camera and open the link. Or open <strong class="tb-page"></strong> and type room code <strong class="tb-room"></strong>.</li><li>Press both big buttons on each tablet. Its lights here show every press.</li></ol>
<p class="sw-note">Only button presses travel between the tablets and this screen, through the Number Crew relay. Keep each tablet awake on its page while the crew plays.</p></div>
<div class="sw-grid">${cards}</div>
<p id="tablet-status" class="sw-status" role="status"></p>
<div class="tp-actions"><button type="button" class="tp-go" data-action="checkin">Start crew check-in <span aria-hidden="true">${icons.arrow(24)}</span></button></div></main></div>`;
  }

  return {
    mount(container) {
      const state = source();
      container.insertAdjacentHTML('beforeend', markup(state));
      root = container.querySelector<HTMLElement>('.tp[data-page="tablets"]')!;
      slots = [...root.querySelectorAll<HTMLElement>('.tb-slot')];
      pilots = [...root.querySelectorAll<HTMLElement>('[data-pilot]')];
      moods = pilots.map(() => 'idle');
      lit = slots.map(() => false);
      this.update(state);
      find<HTMLButtonElement>('[data-action="checkin"]').focus({ preventScroll: true });
    },
    update(state) {
      if (!root) return;
      text(find('.tb-page'), state.page);
      text(find('.tb-room'), spacedRoom(state.room));
      root.querySelectorAll<HTMLElement>('[data-tablet]').forEach(label => {
        const on = state.connected[Number(label.dataset.tablet)];
        text(label, on ? 'Tablet connected' : 'Waiting for tablet');
        label.classList.toggle('is-on', on);
      });
      slots.forEach(slot => {
        const player = Number(slot.dataset.tabletPlayer), side = Number(slot.dataset.tabletSide);
        paintCap(slot, state.caps[player][side]);
        slot.classList.toggle('is-bound', state.connected[player]);
      });
      const ready = state.connected.slice(0, state.players).filter(Boolean).length;
      text(find('#tablet-status'), state.replaced ? 'Another Number Crew window took over these tablets. Use that window, or reload this one to take them back.' : !state.online ? 'Cannot reach the tablet relay yet. Check this computer’s internet connection; it keeps trying.'
        : ready === state.players ? `All ${state.players === 1 ? '' : `${state.players} `}tablets are connected. Next, the crew checks them together.` : `${ready} of ${state.players} tablets connected.`);
    },
    lights(pressed) {
      if (!root) return;
      slots.forEach((slot, n) => {
        const player = Number(slot.dataset.tabletPlayer), side = Number(slot.dataset.tabletSide);
        const on = !!pressed[player]?.[side];
        if (lit[n] === on) return;
        lit[n] = on;
        slot.classList.toggle('is-on', on);
        text(slot.querySelector<HTMLElement>('.sw-chip')!, on ? 'PRESSED' : '');
      });
      pilots.forEach((holder, player) => {
        const mood = moodOf([lit[player * 2], lit[player * 2 + 1]]);
        if (moods[player] !== mood) { moods[player] = mood; holder.innerHTML = pilot(player, mood, 84); }
      });
    },
    unmount() { root = null; slots = []; pilots = []; },
  };
}
