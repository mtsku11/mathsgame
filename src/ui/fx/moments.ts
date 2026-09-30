import { gsap } from 'gsap';
import { events } from '../../app/events';
import { goldStar } from '../art/stars';
import type { Banner } from '../components/banner';
import type { Hub } from '../components/hub';
import type { Station } from '../components/station';
import { stagePoint } from '../stage';
import { arriveAt } from './arrive';
import { after, isCalm, isLowStim, isReduced } from './motion';
import { burst, confetti, trail } from './particles';

export interface MomentTargets {
  layer: HTMLElement;
  stations: () => Station[];
  slotOf: (player: number) => number;
  hub: Hub;
  banner: Banner;
}
export interface Moments { flush(): void; destroy(): void }

const BANNER_SECONDS = 2.5;

// Damped side-to-side rotation ending back at rest; the total time is shared evenly between the swings.
function sway(target: gsap.TweenTarget, angles: number[], seconds: number, origin = '50% 90%'): void {
  gsap.fromTo(target, { rotation: 0, transformOrigin: origin }, { keyframes: angles.map(rotation => ({ rotation, duration: seconds / angles.length, ease: 'sine.inOut' })), overwrite: 'auto', clearProps: 'transform' });
}

// Reacts to game events with motion only. Totals, pills and states are already correct in the DOM; nothing here decides or delays them, except that the crew-star number
// waits for a flying star (hub.hold) and is always released, immediately when a moment is skipped, killed or finished.
// Calm variants (reduced motion, low stimulation, instant) show the same end state with no travel.
export function createMoments(targets: MomentTargets): Moments {
  const { layer, hub, banner } = targets;
  const context = gsap.context(() => {});
  const run = (build: () => void): void => { context.add(build); };
  const finishers = new Set<() => void>();
  let flying = 0;
  const queued: (() => void)[] = [];
  const whenSettled = (action: () => void): void => { if (flying === 0) action(); else queued.push(action); };
  const settle = (): void => { if (flying === 0) queued.splice(0).forEach(action => action()); };
  const station = (player: number): Station | undefined => targets.stations()[targets.slotOf(player)];

  function pulseCore(strong: boolean): void {
    const svg = hub.parts.ship.firstElementChild;
    if (svg) gsap.fromTo(svg, { scale: 1, transformOrigin: '50% 50%' }, { keyframes: [{ scale: strong ? 1.2 : 1.1, duration: 0.12, ease: 'power2.out' }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.45)' }], overwrite: 'auto', clearProps: 'transform' });
    gsap.fromTo(hub.parts.total, { scale: 1.45, svgOrigin: '105 105' }, { scale: 1, svgOrigin: '105 105', duration: 0.42, ease: 'back.out(3)', overwrite: 'auto', clearProps: 'transform' });
  }

  function flyStar(from: { x: number; y: number }): void {
    const to = stagePoint(hub.parts.ship);
    const star = document.createElement('div');
    star.className = 'sp-fly sp-deco';
    star.innerHTML = goldStar();
    layer.append(star);
    hub.hold(1);
    flying++;
    const delay = Math.min(0.13, (flying - 1) * 0.045);
    const path = [from, { x: from.x + (to.x - from.x) * 0.2, y: Math.min(from.y, to.y) - 150 }, { x: from.x + (to.x - from.x) * 0.78, y: to.y - 130 }, to];
    let done = false;
    const end = (landed: boolean): void => {
      if (done) return;
      done = true;
      finishers.delete(kill);
      star.remove();
      flying--;
      hub.release(1);
      if (landed) {
        pulseCore(false);
        burst(to.x, to.y, { count: 12, size: [12, 22], speed: [90, 220], life: [0.4, 0.75] });
      }
      settle();
    };
    const flight = gsap.timeline({ delay, onComplete: () => end(true) });
    const kill = (): void => { flight.kill(); end(false); };
    finishers.add(kill);
    gsap.set(star, { x: from.x, y: from.y, xPercent: -50, yPercent: -50, scale: 0.5, opacity: 0 });
    flight
      .to(star, { opacity: 1, scale: 1.15, duration: 0.14, ease: 'power2.out' }, 0)
      .to(star, { motionPath: { path, type: 'cubic' }, rotation: 320, duration: 0.98, ease: 'power2.inOut',
        onUpdate: () => trail(gsap.getProperty(star, 'x') as number, gsap.getProperty(star, 'y') as number) }, 0.06)
      .to(star, { scale: 0.6, duration: 0.8, ease: 'power1.in' }, 0.24);
  }

  function correct(player: number, side: 0 | 1): void {
    const current = station(player);
    if (!current) return;
    const button = current.parts.buttons[side];
    const from = stagePoint(button);
    burst(from.x, from.y, { count: 26, size: [14, 26], speed: [150, 360], life: [0.55, 1] });
    if (isCalm()) return;
    run(() => {
      gsap.fromTo(button, { scale: 1 }, { keyframes: [{ scale: 1.2, duration: 0.14, ease: 'power2.out' }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }], overwrite: 'auto', clearProps: 'transform' });
      const ring = button.querySelector('.sp-burst');
      if (ring) gsap.fromTo(ring, { scale: 0.35, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)', clearProps: 'transform,opacity' });
      const pilot = current.parts.pilot;
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .set(pilot, { transformOrigin: '50% 90%' })
        .to(pilot, { y: -26, scaleX: 0.95, scaleY: 1.07, duration: 0.16, ease: 'power2.out' })
        .to(pilot, { y: 0, scaleX: 1.06, scaleY: 0.92, duration: 0.14, ease: 'power2.in' })
        .to(pilot, { y: -12, scaleX: 1, scaleY: 1, duration: 0.12, ease: 'power2.out' })
        .to(pilot, { y: 0, duration: 0.3, ease: 'bounce.out', clearProps: 'transform' });
      flyStar(from);
    });
  }

  function tried(player: number, side: 0 | 1): void {
    const current = station(player);
    if (!current) return;
    const button = current.parts.buttons[side];
    if (isCalm()) {
      if (isReduced() || isLowStim()) { button.classList.remove('is-pulse'); void button.offsetWidth; button.classList.add('is-pulse'); }
      return;
    }
    run(() => {
      sway(button, [-7, 6, -4, 2, 0], 0.55, '50% 50%');
      sway(current.parts.pilot, [-8, 5, -2, 0], 0.7);
    });
  }

  function helped(player: number): void {
    const current = station(player);
    if (!current || isCalm()) return;
    const badges = current.parts.objs.querySelectorAll('.sp-badge');
    run(() => {
      gsap.set(badges, { scale: 0 });
      gsap.to(badges, { scale: 1, duration: 0.3, ease: 'back.out(2.6)', stagger: 0.11, delay: 0.05, clearProps: 'transform' });
    });
  }

  function passed(player: number): void {
    const current = station(player);
    if (!current || isCalm()) return;
    run(() => {
      sway(current.parts.pilot, [-7, 6, -5, 4, 0], 0.9);
    });
  }

  function flush(): void {
    [...finishers].forEach(kill => kill());
    queued.length = 0;
    gsap.killTweensOf(banner.card);
    banner.hide();
  }

  function dealIn(): void {
    flush();
    hub.releaseAll();
    if (isCalm()) return;
    const cards = targets.stations().map(current => current.el);
    run(() => {
      gsap.set(cards, { opacity: 0, scale: 0.84, y: 18, transformOrigin: '50% 60%' });
      gsap.to(cards, { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: 'back.out(1.7)', stagger: 0.085, overwrite: 'auto', clearProps: 'opacity,transform' });
    });
  }

  function celebrate(round: number): void {
    const core = stagePoint(hub.parts.ship);
    const pip = hub.parts.pips[round - 1];
    burst(core.x, core.y, { count: 44, size: [16, 30], speed: [220, 470], life: [0.7, 1.2] });
    if (pip) { const at = stagePoint(pip); burst(at.x, at.y, { count: 12, size: [8, 14], speed: [60, 150], life: [0.4, 0.8] }); }
    banner.show('All stars collected!');
    if (isCalm()) {
      gsap.set(banner.card, { clearProps: 'all' });
      after(BANNER_SECONDS, () => banner.hide());
      return;
    }
    confetti({ x: core.x - 150, width: 300, y: core.y - 130, count: 46, duration: 1.4, life: [1.2, 2] });
    run(() => {
      pulseCore(true);
      if (pip) gsap.fromTo(pip, { scale: 1, rotation: 0 }, { keyframes: [{ scale: 1.7, rotation: 25, duration: 0.18 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'elastic.out(1,0.5)' }], overwrite: 'auto', clearProps: 'transform' });
      gsap.timeline({ onComplete: () => banner.hide() })
        .fromTo(banner.card, { scale: 0.3, opacity: 0, y: 24 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2.2)' }, 0)
        .to(banner.card, { opacity: 0, y: -26, duration: 0.4, ease: 'power1.in' }, BANNER_SECONDS - 0.4);
    });
  }

  const subscriptions = [
    events.on('answerCorrect', ({ player, side }) => correct(player, side)),
    events.on('answerTry', ({ player, side }) => tried(player, side)),
    events.on('turnHelped', ({ player }) => helped(player)),
    events.on('turnPassed', ({ player }) => passed(player)),
    events.on('roundStart', dealIn),
    events.on('roundReady', ({ round }) => whenSettled(() => celebrate(round))),
    events.on('destinationReached', ({ destination }) => arriveAt(destination)),
  ];

  return {
    flush,
    destroy() {
      subscriptions.forEach(off => off());
      flush();
      hub.releaseAll();
      context.kill();
      layer.replaceChildren();
    },
  };
}
