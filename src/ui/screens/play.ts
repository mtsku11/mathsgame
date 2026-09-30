import '../play.css';
import type { Screen } from '../../app/router';
import type { Side } from '../../game/questions';
import { destinationOf } from '../art/planets';
import { skyStars } from '../art/stars';
import { createHub, type Hub, type HubState } from '../components/hub';
import { createHud, type Hud } from '../components/hud';
import { geoOf } from '../components/objects';
import { createPauseOverlay, type PauseOverlay, type PauseState } from '../components/pauseOverlay';
import { createStation, type Station, type StationState } from '../components/station';
import { createStage, type Stage } from '../stage';

export interface PlayState {
  players: number; round: number; completed: number; stars: number;
  stations: StationState[]; next: string | null; turn: string; pause: PauseState;
}
export interface PlayScreen extends Screen { update(state: PlayState): void; press(player: number, side: Side): void }

export function createPlayScreen(source: () => PlayState): PlayScreen {
  let stage: Stage | null = null;
  let root: HTMLElement | null = null;
  let hud: Hud, hub: Hub, overlay: PauseOverlay;
  let stations: Station[] = [];
  let players: number[] = [];
  const screen: PlayScreen = {
    mount(container) {
      const initial = source();
      const layout = initial.players;
      const geo = geoOf(layout);
      stage = createStage(container);
      stage.element.innerHTML = `<div class="sp-space sp-deco" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(7)}</div>`;
      root = document.createElement('div');
      root.className = `sp-play sp-g${geo} sp-n${layout}`;
      root.innerHTML = '<h1 class="sr-only">Number Crew mission</h1>';
      stage.element.append(root);
      hud = createHud();
      hub = createHub({ players: layout, geo });
      hub.mount(root);
      hud.mount(root);
      stations = Array.from({ length: initial.stations.length }, (_, slot) => { const station = createStation(slot, geo); station.mount(root!); return station; });
      overlay = createPauseOverlay();
      overlay.mount(stage.viewport);
      screen.update(initial);
    },
    update(state) {
      if (!root) return;
      players = state.stations.map(station => station.player);
      state.stations.forEach((station, slot) => stations[slot]?.update(station));
      const hubState: HubState = { destination: destinationOf(state.round), round: state.round, completed: state.completed, stars: state.stars, next: state.next, turn: state.turn,
        slots: state.stations.map(station => ({ player: station.player, done: station.outcome === 'correct' })) };
      hud.update({ destination: Math.min(2, Math.floor(state.completed / 2)) });
      hub.update(hubState);
      root.inert = state.pause.paused;
      overlay.update(state.pause);
    },
    press(player, side) { stations[players.indexOf(player)]?.press(side); },
    unmount() {
      stations.forEach(station => station.destroy());
      stations = [];
      stage?.destroy();
      stage = null;
      root = null;
    },
  };
  return screen;
}
