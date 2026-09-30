import { gsap } from 'gsap';
import type { Hub } from '../components/hub';
import type { Hud } from '../components/hud';
import { stagePoint } from '../stage';
import { after, isCalm } from './motion';
import { burst } from './particles';

export interface ArrivalTarget { hub: Hub; hud: Hud }

const CARD_SECONDS = 2.5;
let target: ArrivalTarget | null = null;
let context: ReturnType<typeof gsap.context> | null = null;
let hideCard: gsap.core.Tween | null = null;

// The play screen binds its hub and route while mounted; `arriveAt` does nothing when no play screen is bound.
export function bindArrival(next: ArrivalTarget | null): void {
  context?.kill();
  hideCard?.kill();
  hideCard = null;
  target = next;
  context = next ? gsap.context(() => {}) : null;
}

// The new planet swells from a dot to hero size in the hub with a shimmer ring and a "Welcome to" card, and the route in the HUD pops. Progress is never read from it:
// the hub and route already show the new destination; Phase 3's Warp Drive calls this at the end of hyperspace.
export function arriveAt(destination: 0 | 1 | 2): void {
  if (!target || !context) return;
  const { hub, hud } = target;
  const { hero } = hub.parts;
  hub.showDestination(destination);
  const { planet, card, rings, size } = hero;
  const cx = planet.offsetLeft + planet.offsetWidth / 2, cy = planet.offsetTop + planet.offsetHeight / 2;
  card.style.top = `${cy + size / 2 + 2}px`;
  rings.forEach(ring => Object.assign(ring.style, { left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px` }));
  hideCard?.kill();
  gsap.killTweensOf([planet, card, ...rings]);
  gsap.set([planet, card, ...rings], { clearProps: 'transform,opacity' });
  card.hidden = false;
  if (isCalm()) {
    hideCard = after(CARD_SECONDS, () => { card.hidden = true; });
    return;
  }
  const stop = hud.stops[destination];
  const before = hud.stops[destination - 1];
  const centre = stagePoint(planet);
  context.add(() => {
    gsap.set(planet, { scale: 0.04, opacity: 0, transformOrigin: '50% 50%' });
    gsap.set(card, { opacity: 0 });
    gsap.timeline()
      .to(planet, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0)
      .to(planet, { scale: 1.14, duration: 1.4, ease: 'power3.out' }, 0)
      .to(planet, { scale: 1, duration: 0.4, ease: 'sine.inOut', clearProps: 'transform,opacity' }, 1.4)
      .fromTo(rings[0], { scale: 0.45, opacity: 0.95 }, { scale: 2.4, opacity: 0, duration: 1.3, ease: 'power2.out', immediateRender: false }, 0.15)
      .fromTo(rings[1], { scale: 0.45, opacity: 0.7 }, { scale: 2.4, opacity: 0, duration: 1.3, ease: 'power2.out', immediateRender: false }, 0.55)
      .call(() => burst(centre.x, centre.y, { count: 22, size: [12, 24], speed: [120, 300], life: [0.6, 1.1], colours: [0xFFFFFF, 0xFFE58A, 0xC4BAFF] }), [], 1.3)
      .fromTo(card, { scale: 0.5, opacity: 0, y: 14 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2.2)' }, 0.9)
      .to(card, { opacity: 0, y: -12, duration: 0.4, ease: 'power1.in', onComplete: () => { card.hidden = true; gsap.set(card, { clearProps: 'transform,opacity' }); } }, 0.9 + CARD_SECONDS - 0.4);
    const art = stop?.querySelector('.sp-planet');
    if (art) gsap.fromTo(art, { scale: 1, transformOrigin: '50% 50%' }, { keyframes: [{ scale: 1.35, duration: 0.25 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1,0.45)' }], delay: 0.2, clearProps: 'transform' });
    const badge = before?.querySelector('.sp-vstar');
    if (badge) gsap.fromTo(badge, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(3)', delay: 0.3, clearProps: 'transform' });
  });
}
