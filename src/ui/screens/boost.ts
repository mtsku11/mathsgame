import '../boost.css';
import { gsap } from 'gsap';
import type { BoostTheme, BoostTier } from '../../app/events';
import { IDLE_NUDGE_MS, type BoostPhase } from '../../game/boost';
import { icons } from '../art/icons';
import { pilotColors } from '../art/pilot';
import { createBoostCards, type BoostCards } from '../components/boostCards';
import { createPowerMeter, type PowerMeter } from '../components/powerMeter';
import { createSaucer, saucerCentres, SAUCER_TOP, SAUCER_WIDTH, type Saucer } from '../components/saucer';
import type { Station } from '../components/station';
import { createTimerRing, type TimerRing } from '../components/timerRing';
import { isCalm, isInstant, isReduced } from '../fx/motion';
import { createScene, colourOf, type BoostScene, type Destination } from '../fx/boostScenes/scene';
import { burst, trail } from '../fx/particles';
import { getFx } from '../fx/pixi';
import { stagePoint, type Stage } from '../stage';

export interface BoostConfig { round: number; theme: BoostTheme; players: number; stars: number; destination: Destination | null }
// Continuous values, refreshed every frame from the game state. The view never derives a tier, a time or a result on its own.
export interface BoostSnapshot {
  phase: BoostPhase; fraction: number; timeLeft: number; countdown: number | null; wrap: boolean; finaleTier: BoostTier | null;
  heat: number[]; idle: number[];
}
export interface BoostView {
  readonly active: boolean;
  begin(config: BoostConfig): void;
  update(snapshot: BoostSnapshot): void;
  go(): void;
  press(player: number): void;
  tier(tier: BoostTier): void;
  finale(tier: BoostTier): void;
  // The crew has reached the next destination: bring the hub back so the planet can swell into it.
  arrive(): void;
  end(mode: 'wrapped' | 'skipped'): void;
  setPaused(paused: boolean): void;
}
export interface BoostEnv {
  stage: Stage;
  root: HTMLElement;
  stations: () => Station[];
  players: () => number[];
  onTap: (player: number) => void;
}
export interface BoostScreen extends BoostView { destroy(): void }

interface Run {
  config: BoostConfig; scene: BoostScene; world: HTMLElement; top: HTMLElement; row: HTMLElement; hud: HTMLElement; beams: SVGPathElement[];
  saucers: Saucer[]; meter: PowerMeter; ring: TimerRing; cards: BoostCards; chrome: Element[]; stationMoves: { el: HTMLElement; x: number; y: number; scale: number }[];
  countdown: number | null; wrapShown: boolean; fraction: number; nudged: number[]; tier: number; chromeShown: boolean; bolts: Set<Bolt>; liveOver: boolean;
  ended: boolean; hudVisible: boolean; sceneGone: boolean; nebulas: Element[]; nebulaBase: number[];
}

// An energy bolt in flight: kill drops it silently, land delivers it at once (the live phase is over and nothing may still be travelling).
interface Bolt { kill(): void; land(): void }

const TARGET_FLIGHT = [0.22, 0.28];
const MAX_BOLTS = 14;
const CHROME = '.sp-hud, .sp-hub, .sp-beams, .sp-big';
const still = (): boolean => isReduced() || isInstant();

export function createBoostScreen(env: BoostEnv): BoostScreen {
  let run: Run | null = null;
  const leaving = new Set<() => void>();

  function place(r: Run): void {
    env.stations().forEach((station, slot) => {
      const player = env.players()[slot];
      const saucer = r.saucers[player];
      const at = stagePoint(station.el);
      const to = saucer ? saucer.centre : { x: 640, y: SAUCER_TOP + 40 };
      r.stationMoves.push({ el: station.el, x: to.x - at.x, y: to.y - at.y, scale: SAUCER_WIDTH / Math.max(1, station.el.offsetWidth) });
    });
  }

  function shake(pixels: number, seconds: number): void {
    const r = run;
    if (!r || isCalm()) return;
    const amplitude = Math.min(6, pixels);
    const targets = [r.world, r.top, document.querySelector('.fx-canvas')].filter((target): target is Element => target !== null);
    const steps = 8;
    const keyframes = Array.from({ length: steps }, (_, i) => { const fade = 1 - i / steps; return { x: (Math.random() * 2 - 1) * amplitude * fade, y: (Math.random() * 2 - 1) * amplitude * fade, duration: seconds / steps }; });
    gsap.to(targets, { keyframes: [...keyframes, { x: 0, y: 0, duration: seconds / steps }], ease: 'none', overwrite: 'auto', clearProps: 'transform' });
  }

  function showChrome(r: Run, seconds: number): void {
    if (r.chromeShown) return;
    r.chromeShown = true;
    gsap.to(r.chrome, { opacity: 1, duration: seconds, ease: 'power1.inOut', overwrite: 'auto', clearProps: 'opacity' });
  }

  function hideHud(r: Run): void {
    if (!r.hudVisible) return;
    r.hudVisible = false;
    gsap.to(r.hud, { opacity: 0, duration: 0.4, overwrite: 'auto' });
  }

  function fireBolt(r: Run, saucer: Saucer): void {
    const target = r.scene.target;
    const colour = colourOf(saucer.player);
    const arrive = (): void => {
      burst(target.x, target.y, { count: 8 + Math.floor(Math.random() * 5), colours: [colour, 0xFFFFFF], shapes: ['star', 'sparkle'], size: [10, 18], speed: [80, 220], life: [0.3, 0.6], gravity: 120 });
      r.scene.onPress(saucer.player, r.fraction);
    };
    if (still() || r.scene.direct) { r.scene.onPress(saucer.player, r.fraction); return; }
    if (r.bolts.size >= MAX_BOLTS) { arrive(); return; }
    const from = { x: saucer.centre.x, y: SAUCER_TOP + 8 };
    const bend = (saucer.player % 2 ? 1 : -1) * (40 + Math.random() * 40);
    const control = { x: (from.x + target.x) / 2 + bend, y: (from.y + target.y) / 2 };
    const progress = { t: 0 };
    const tween = gsap.to(progress, {
      t: 1, duration: TARGET_FLIGHT[0] + Math.random() * (TARGET_FLIGHT[1] - TARGET_FLIGHT[0]), ease: 'power1.in',
      onUpdate() {
        const t = progress.t, u = 1 - t;
        const x = u * u * from.x + 2 * u * t * control.x + t * t * target.x, y = u * u * from.y + 2 * u * t * control.y + t * t * target.y;
        burst(x, y, { count: 1, colours: [colour, 0xFFFFFF], shapes: ['star'], size: [24, 32], speed: [0, 8], life: [0.05, 0.08], gravity: 0, spread: 0 });
        trail(x, y, { colours: [colour, 0xFFFFFF], size: [10, 18], life: [0.25, 0.45] });
      },
      onComplete() { r.bolts.delete(bolt); arrive(); },
    });
    const bolt: Bolt = { kill: () => { tween.kill(); }, land: () => { tween.kill(); arrive(); } };
    r.bolts.add(bolt);
  }

  function nudge(saucer: Saucer): void {
    if (isCalm()) return;
    saucer.wiggle();
    const at = stagePoint(saucer.el);
    burst(at.x, SAUCER_TOP - 10, { count: 6, colours: [colourOf(saucer.player), 0xFFFFFF], shapes: ['sparkle'], size: [12, 20], speed: [40, 120], life: [0.5, 0.9], gravity: -30, angle: -Math.PI / 2, spread: 1.6 });
  }

  function unmountScene(r: Run): void {
    if (r.sceneGone) return;
    r.sceneGone = true;
    r.scene.unmount();
  }

  function teardown(r: Run): void {
    r.ended = true;
    r.bolts.forEach(bolt => bolt.kill());
    r.bolts.clear();
    unmountScene(r);
    r.world.remove();
    r.top.remove();
    const canvas = document.querySelector('.fx-canvas');
    if (canvas) gsap.set(canvas, { clearProps: 'transform' });
  }

  function finish(r: Run, fast: boolean): void {
    run = null;
    r.ended = true;
    r.bolts.forEach(bolt => bolt.kill());
    r.bolts.clear();
    gsap.globalTimeline.paused(false);
    r.cards.hideBadge();
    r.cards.hideTitle();
    const seconds = fast ? 0.2 : 0.5;
    showChrome(r, seconds);
    const calm = isCalm();
    r.stationMoves.forEach(({ el, x, y, scale }, i) => {
      gsap.killTweensOf(el);
      if (calm || fast) gsap.fromTo(el, { x: 0, y: 0, scale: 1, opacity: 0 }, { opacity: 1, duration: seconds, clearProps: 'transform,opacity' });
      else gsap.fromTo(el, { x, y, scale, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.55, delay: i * 0.05, ease: 'back.out(1.5)', clearProps: 'transform,opacity' });
    });
    gsap.to(r.nebulas, { opacity: (i: number) => r.nebulaBase[i], duration: seconds + 0.3, overwrite: 'auto', clearProps: 'opacity' });
    gsap.to(r.row, { opacity: 0, duration: seconds, ease: 'power1.in' });
    gsap.to(r.hud, { opacity: 0, duration: seconds });
    const done = (): void => { leaving.delete(done); teardown(r); env.root.classList.remove('is-boosting'); env.root.inert = false; };
    leaving.add(done);
    // A finished boost fades its scene out with the stage coming back, so a backdrop such as the fireworks' horizon never vanishes in a single frame.
    // A skipped one is cut at once: the teacher asked for it to stop.
    if (fast) unmountScene(r); else gsap.to(r.world, { opacity: 0, duration: seconds, ease: 'power1.in', overwrite: 'auto' });
    gsap.delayedCall(seconds + (r.stationMoves.length ? 0.35 : 0) + (calm || fast ? 0 : 0.2), done);
  }

  const screen: BoostScreen = {
    get active() { return run !== null; },
    begin(config) {
      if (run) { finish(run, true); }
      const world = document.createElement('div');
      world.className = 'sp-bworld sp-deco';
      world.setAttribute('aria-hidden', 'true');
      const top = document.createElement('section');
      top.className = 'sp-btop';
      top.setAttribute('aria-label', 'Boost round');
      const canvas = env.stage.element.querySelector('.fx-canvas');
      if (canvas) canvas.before(world); else env.stage.element.append(world);
      // The target and beams stay hidden through the intro so the countdown has the stage to itself, and appear as the round starts.
      gsap.set(world, { opacity: 0 });
      env.stage.element.append(top);
      const hud = document.createElement('div');
      hud.className = 'sp-bhud';
      const meter = createPowerMeter(), ring = createTimerRing(), cards = createBoostCards();
      const row = document.createElement('div');
      row.className = 'sp-brow';
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'sp-pause sp-boost-pause';
      pause.dataset.action = 'pause';
      pause.setAttribute('aria-label', 'Pause game');
      pause.innerHTML = icons.pause(24);
      meter.mount(hud); ring.mount(hud);
      top.append(hud, row, cards.el, pause);
      const saucers = saucerCentres(config.players).map((x, player) => createSaucer(player, x));
      saucers.forEach(saucer => saucer.mount(row));
      const scene = createScene(config.theme);
      const r: Run = {
        config, scene, world, top, row, hud, beams: [], saucers, meter, ring, cards, stationMoves: [], countdown: null, wrapShown: false, fraction: 0, nudged: saucers.map(() => 0), tier: 0,
        chrome: [...env.root.children].filter(child => child.matches(CHROME)), chromeShown: false, bolts: new Set(), liveOver: false, ended: false, hudVisible: false, sceneGone: false,
        nebulas: [...env.stage.element.querySelectorAll('.sp-neb')], nebulaBase: [],
      };
      r.nebulaBase = r.nebulas.map(nebula => Number(getComputedStyle(nebula).opacity));
      run = r;
      env.root.classList.add('is-boosting');
      env.root.inert = true;
      scene.mount({
        world, top, fx: getFx(), players: config.players, colours: saucers.map(saucer => colourOf(saucer.player)), saucers: saucers.map(saucer => saucer.pilot), round: config.round,
        stars: config.stars, destination: config.destination, shake,
      });
      const beams = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      beams.setAttribute('class', 'sp-bbeams');
      beams.setAttribute('viewBox', '0 0 1280 720');
      const target = scene.target;
      // A scene that reacts at the press itself (fireworks) has nothing for a beam to point at.
      beams.innerHTML = scene.direct ? '' : saucers.map(saucer => {
        const bend = (saucer.player % 2 ? 1 : -1) * 60;
        return `<path class="sp-bbeam sp-p${saucer.player}" d="M${saucer.centre.x} ${SAUCER_TOP + 8} Q ${(saucer.centre.x + target.x) / 2 + bend} ${(SAUCER_TOP + target.y) / 2} ${target.x} ${target.y}" style="stroke:${pilotColors[saucer.player].color}"/>`;
      }).join('');
      r.beams = [...beams.querySelectorAll<SVGPathElement>('path')];
      world.prepend(beams);
      place(r);
      cards.title(config.theme);
      gsap.set(hud, { opacity: 0, y: -24 });
      if (isCalm()) {
        gsap.to(r.chrome, { opacity: 0, duration: 0.3 });
        r.stationMoves.forEach(({ el }) => gsap.to(el, { opacity: 0, duration: 0.3 }));
        saucers.forEach(saucer => gsap.fromTo(saucer.el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.2 }));
      } else {
        gsap.to(r.chrome, { opacity: 0, duration: 0.4, ease: 'power1.out' });
        r.stationMoves.forEach(({ el, x, y, scale }, i) => {
          gsap.set(el, { transformOrigin: '50% 50%' });
          gsap.to(el, { x, y, scale, duration: 0.85, delay: i * 0.05, ease: 'power3.in', overwrite: 'auto' });
          gsap.to(el, { opacity: 0, duration: 0.35, delay: 0.5 + i * 0.05, ease: 'power1.in' });
        });
        saucers.forEach((saucer, i) => gsap.from(saucer.el, { opacity: 0, scale: 0.4, y: 40, duration: 0.5, delay: 0.55 + i * 0.07, ease: 'back.out(1.7)' }));
      }
      top.addEventListener('pointerdown', event => {
        const button = (event.target as Element).closest<HTMLElement>('[data-boost-player]');
        if (button && event.button === 0) env.onTap(Number(button.dataset.boostPlayer));
      });
      // Keyboard and assistive-technology activation arrives as a click with no pointer (detail 0); real pointer taps were already counted on pointerdown.
      top.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('[data-boost-player]');
        if (button && (event as MouseEvent).detail === 0) env.onTap(Number(button.dataset.boostPlayer));
      });
    },
    update(s) {
      const r = run;
      if (!r || r.ended) return;
      if (s.countdown !== r.countdown) { r.countdown = s.countdown; if (s.countdown !== null) r.cards.count(s.countdown); }
      r.fraction = s.fraction;
      r.meter.set(s.fraction);
      r.ring.set(s.timeLeft);
      r.saucers.forEach((saucer, i) => {
        saucer.setHeat(s.heat[i] ?? 0);
        const due = Math.floor((s.idle[i] ?? 0) / IDLE_NUDGE_MS);
        if (due > r.nudged[i]) nudge(saucer);
        r.nudged[i] = due;
      });
      if (!r.liveOver) r.beams.forEach((beam, i) => { const opacity = (0.2 + 0.7 * (s.heat[i] ?? 0)).toFixed(2); if (beam.style.opacity !== opacity) beam.style.opacity = opacity; });
      if (s.wrap && !r.wrapShown && s.finaleTier) {
        r.wrapShown = true;
        hideHud(r);
        r.cards.badge(s.finaleTier, r.config.destination !== null);
        r.saucers.forEach((saucer, i) => gsap.delayedCall(i * 0.07, () => saucer.cheer()));
      }
    },
    go() {
      const r = run;
      if (!r) return;
      r.cards.hideTitle();
      r.cards.go();
      r.saucers.forEach(saucer => saucer.setMood('boost'));
      r.row.classList.add('is-live');
      gsap.to(r.world, { opacity: 1, duration: 0.4, ease: 'power1.out' });
      r.hudVisible = true;
      if (isCalm()) gsap.to(r.hud, { opacity: 1, duration: 0.3 }); else gsap.to(r.hud, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' });
    },
    press(player) {
      const r = run;
      const saucer = r?.saucers[player];
      if (!r || !saucer || r.ended) return;
      saucer.squash();
      fireBolt(r, saucer);
    },
    tier(tier) {
      const r = run;
      if (!r || r.ended) return;
      r.tier = tier;
      r.meter.light(tier);
      const star = r.meter.stars[tier - 1];
      if (!isCalm()) {
        gsap.fromTo(star, { scale: 1 }, { keyframes: [{ scale: 1.6, duration: 0.14, ease: 'power2.out' }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.45)' }], overwrite: 'auto', clearProps: 'transform' });
        const at = stagePoint(star);
        burst(at.x, at.y, { count: 16, colours: [0xFFD23F, 0xFFF0A8, 0xFFFFFF], size: [12, 22], speed: [90, 240], life: [0.4, 0.8] });
      }
      // The background nebula brightens one step per tier.
      if (!isCalm()) gsap.to(r.nebulas, { opacity: (i: number) => Math.min(0.9, r.nebulaBase[i] + 0.09 * tier), duration: 0.6, ease: 'sine.out', overwrite: 'auto' });
      r.cards.word(tier);
      r.scene.onTier(tier);
    },
    finale(tier) {
      const r = run;
      if (!r || r.ended) return;
      r.saucers.forEach(saucer => saucer.setMood('cheer'));
      r.row.classList.remove('is-live');
      hideHud(r);
      // The live phase is over: bolts still travelling land now and the beams fade, so nothing of the pressing lingers into the payoff.
      r.liveOver = true;
      const landing = [...r.bolts];
      r.bolts.clear();
      landing.forEach(bolt => bolt.land());
      if (r.beams.length) gsap.to(r.beams, { autoAlpha: 0, duration: 0.3, overwrite: 'auto' });
      void r.scene.playFinale(tier).catch(error => console.warn('Boost finale failed; continuing.', error));
    },
    arrive() {
      const r = run;
      if (r) showChrome(r, isCalm() ? 0.4 : 0.6);
    },
    end(mode) {
      const r = run;
      if (r) finish(r, mode === 'skipped');
    },
    setPaused(paused) {
      gsap.globalTimeline.paused(paused);
      const r = run;
      if (!r) return;
      r.scene.setPaused(paused);
      r.top.inert = paused;
    },
    destroy() {
      gsap.globalTimeline.paused(false);
      const r = run;
      run = null;
      leaving.forEach(done => done());
      leaving.clear();
      if (r) {
        r.stationMoves.forEach(({ el }) => { gsap.killTweensOf(el); gsap.set(el, { clearProps: 'transform,opacity' }); });
        gsap.killTweensOf(r.chrome);
        gsap.set(r.chrome, { clearProps: 'opacity' });
        gsap.killTweensOf(r.nebulas);
        gsap.set(r.nebulas, { clearProps: 'opacity' });
        teardown(r);
      }
      env.root.classList.remove('is-boosting');
      env.root.inert = false;
    },
  };
  return screen;
}
