import { gsap } from 'gsap';
import type { BoostTheme, BoostTier } from '../../../app/events';
import { payoffMs } from '../../../game/boost';
import { goldStar } from '../../art/stars';
import { after, isCalm } from '../motion';
import { burst, confetti, gold, rain } from '../particles';
import type { BoostScene, SceneContext } from './scene';

const words: Record<BoostTier, string> = { 1: 'BOOST!', 2: 'SUPER BOOST!', 3: 'MEGA BOOST!' };
const CENTRE = { x: 640, y: 300 };

// PLACEHOLDER, Phase 3b replaces it. The Firework Frenzy and Bubble Blast rounds use this generic target until their own scenes exist: a big gold star that grows with
// the meter and bursts at the end. It goes through the same BoostScene interface as Warp Drive, so 3b adds two scene files and changes only createScene().
export function createPlaceholderScene(theme: BoostTheme): BoostScene {
  let context: SceneContext | null = null;
  let star: HTMLElement | null = null;
  let card: HTMLElement | null = null;
  let finish: (() => void) | null = null;
  const scaleFor = (progress: number): number => 0.55 + 0.7 * progress;

  return {
    target: CENTRE,
    mount(next) {
      context = next;
      star = document.createElement('div');
      star.className = 'sp-ph';
      star.dataset.boostPlaceholder = theme;
      star.setAttribute('aria-hidden', 'true');
      star.innerHTML = goldStar();
      context.world.append(star);
      card = document.createElement('p');
      card.className = 'sp-bgiant';
      card.hidden = true;
      context.top.append(card);
      gsap.set(star, { scale: scaleFor(0), transformOrigin: '50% 50%' });
    },
    onPress(_player, progress) {
      if (!star) return;
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(star, { scale: scaleFor(progress) * 1.03, duration: 0.08, ease: 'power2.out' })
        .to(star, { scale: scaleFor(progress), duration: 0.12, ease: 'power2.in' });
    },
    onTier() {
      if (!star) return;
      gsap.fromTo(star, { rotation: 0 }, { keyframes: [{ rotation: -8, duration: 0.12 }, { rotation: 6, duration: 0.14 }, { rotation: 0, duration: 0.2, ease: 'elastic.out(1,0.5)' }], overwrite: 'auto' });
    },
    playFinale(tier) {
      const current = context;
      if (!current || !star || !card) return Promise.resolve();
      const seconds = payoffMs(theme, tier) / 1000;
      card.textContent = words[tier];
      card.hidden = false;
      const calm = isCalm();
      const target = star, label = card;
      gsap.killTweensOf(target);
      if (calm) {
        gsap.fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.5 });
        gsap.to(label, { opacity: 0, duration: 0.5, delay: Math.max(0.5, seconds - 0.8) });
        gsap.to(target, { scale: 1.3, duration: 0.6 });
      } else {
        const power = tier === 3 ? 1 : tier === 2 ? 0.6 : 0.35;
        gsap.timeline()
          .to(target, { scale: 1.5, duration: 0.18, ease: 'power2.out' })
          .call(() => {
            burst(CENTRE.x, CENTRE.y, { count: Math.round(120 * power), size: [16, 34], speed: [260, 620], life: [0.8, 1.4], colours: [...gold, 0xFF5DA2, 0x36D6FF, 0x9DF26B] });
            if (tier === 3) { confetti({ x: 0, width: 1280, count: 110, duration: 1.6 }); rain({ x: 200, width: 880, count: 40, duration: 1.4 }); }
          })
          .to(target, { scale: 0.2, opacity: 0, duration: 0.25, ease: 'power2.in' })
          .fromTo(label, { scale: 1.5, opacity: 0, rotation: -6 }, { scale: 1, opacity: 1, rotation: -3, duration: 0.45, ease: 'elastic.out(1,0.5)' }, 0.3)
          .to(label, { opacity: 0, y: -30, duration: 0.4, ease: 'power1.in' }, Math.max(0.8, seconds - 0.5));
      }
      return new Promise(resolve => { finish = resolve; after(seconds, () => { finish = null; resolve(); }); });
    },
    setPaused() { /* everything here is a GSAP tween or a delayed call, which the view pauses with the global timeline */ },
    unmount() {
      finish?.();
      finish = null;
      if (star) gsap.killTweensOf(star);
      if (card) gsap.killTweensOf(card);
      star?.remove();
      card?.remove();
      star = card = null;
      context = null;
    },
  };
}
