import '../play.css';
import type { Screen } from '../../app/router';
import type { Side } from '../../game/questions';
import { skyStars } from '../art/stars';
import type { Quality } from '../../settings';
import { createBanner, type Banner } from '../components/banner';
import { createHub, type Hub, type HubState } from '../components/hub';
import { createHud, type Hud } from '../components/hud';
import { geoOf } from '../components/objects';
import { createRests, type RestState, type Rests } from '../components/rests';
import { createPauseOverlay, type PauseOverlay, type PauseState } from '../components/pauseOverlay';
import { createStation, type Station, type StationState } from '../components/station';
import { bindArrival } from '../fx/arrive';
import { createMoments, type Moments } from '../fx/moments';
import { attachParticles, detachParticles } from '../fx/particles';
import { destroyFx, initFx, particleResolution, resolveQuality } from '../fx/pixi';
import { fromTo, isCalm, kill } from '../fx/motion';
import { createStage, type Stage } from '../stage';
import { createBoostScreen, type BoostScreen, type BoostView } from './boost';

export interface PlayState {
  players: number; round: number; completed: number; stars: number; ready: boolean;
  stations: StationState[]; next: string | null; turn: string; pause: PauseState;
  // Spotlight: one station fills the stage and everyone else rests at the edge.
  spotlight: boolean; rest: RestState[];
  // The destination the hub and route show: the round's own, or the next planet once a Warp Drive finale has reached it.
  destination: 0 | 1 | 2;
  perfect: boolean;
}
export interface PlayScreen extends Screen { update(state: PlayState): void; press(player: number, side: Side): void; readonly boost: BoostView }

export function createPlayScreen(source: () => PlayState, options: { quality: () => Quality; onBoostTap: (player: number) => void }): PlayScreen {
  let stage: Stage | null = null;
  let root: HTMLElement | null = null;
  let hud: Hud, hub: Hub, overlay: PauseOverlay, banner: Banner;
  let rests: Rests | null = null;
  let turn = { player: -1, round: 0 };
  let moments: Moments | null = null;
  let stations: Station[] = [];
  let players: number[] = [];
  let perfect = false;
  let boostScreen: BoostScreen | null = null;
  // The boost view only exists while the play screen is mounted; calls in between do nothing, so the game flow never has to ask whether a screen is there.
  const boost: BoostView = {
    get active() { return boostScreen?.active ?? false; },
    begin: config => boostScreen?.begin(config), update: snapshot => boostScreen?.update(snapshot), go: () => boostScreen?.go(), press: player => boostScreen?.press(player),
    tier: tier => boostScreen?.tier(tier), finale: tier => boostScreen?.finale(tier), arrive: () => boostScreen?.arrive(), end: mode => boostScreen?.end(mode),
    setPaused: paused => boostScreen?.setPaused(paused),
  };
  const screen: PlayScreen = {
    mount(container) {
      const initial = source();
      const layout = initial.players;
      const geo = geoOf(layout);
      stage = createStage(container);
      stage.element.innerHTML = `<div class="sp-space sp-deco" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(7)}</div>`;
      root = document.createElement('div');
      root.className = `sp-play sp-g${geo} sp-n${layout}${initial.spotlight ? ' sp-spot' : ''}`;
      root.innerHTML = '<h1 class="sr-only">Number Crew mission</h1>';
      stage.element.append(root);
      hud = createHud();
      hub = createHub({ players: layout, geo });
      hub.mount(root);
      hud.mount(root);
      stations = Array.from({ length: initial.stations.length }, (_, slot) => { const station = createStation(slot, geo); station.mount(root!); return station; });
      if (initial.spotlight) { rests = createRests(); rests.mount(root); }
      banner = createBanner();
      banner.mount(root);
      const layer = document.createElement('div');
      layer.className = 'sp-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      root.append(layer);
      overlay = createPauseOverlay();
      overlay.mount(stage.viewport);
      screen.update(initial);
      moments = createMoments({ layer, hub, banner, stations: () => stations, slotOf: player => players.indexOf(player), perfect: () => perfect });
      boostScreen = createBoostScreen({ stage, root, stations: () => stations, players: () => players, onTap: options.onBoostTap });
      bindArrival({ hub, hud });
      void initFx(options.quality(), { maxResolution: particleResolution(), antialias: false }).then(app => { if (app) void attachParticles(app, resolveQuality(options.quality())); });
    },
    update(state) {
      if (!root) return;
      players = state.stations.map(station => station.player);
      perfect = state.perfect;
      state.stations.forEach((station, slot) => stations[slot]?.update(station));
      rests?.update(state.rest);
      // A new pupil's turn slides the station in; a new round is dealt in by the round moment instead.
      const shown = state.stations[0]?.player ?? -1;
      if (state.spotlight && turn.player >= 0 && shown !== turn.player && state.round === turn.round && stations[0] && !isCalm()) {
        kill(stations[0].el);
        fromTo(stations[0].el, { opacity: 0, x: 60, scale: 0.94 }, { opacity: 1, x: 0, scale: 1, duration: 0.45, ease: 'power3.out', clearProps: 'opacity,transform' });
      }
      turn = { player: shown, round: state.round };
      const hubState: HubState = { destination: state.destination, round: state.round, completed: state.completed, stars: state.stars, ready: state.ready, next: state.next, turn: state.turn,
        slots: state.stations.map(station => ({ player: station.player, done: station.outcome === 'correct' })) };
      hud.update({ destination: state.destination });
      hub.update(hubState);
      root.inert = state.pause.paused || boost.active;
      overlay.update(state.pause);
    },
    boost,
    press(player, side) { stations[players.indexOf(player)]?.press(side); },
    unmount() {
      boostScreen?.destroy();
      boostScreen = null;
      rests = null;
      turn = { player: -1, round: 0 };
      moments?.destroy();
      moments = null;
      bindArrival(null);
      detachParticles();
      destroyFx();
      stations.forEach(station => station.destroy());
      stations = [];
      stage?.destroy();
      stage = null;
      root = null;
    },
  };
  return screen;
}
