import { gsap } from 'gsap';
import type { BoostTheme, BoostTier } from '../../app/events';
import { isCalm } from '../fx/motion';

export const themeNames: Record<BoostTheme, string> = { fireworkFrenzy: 'Firework Frenzy', warpDrive: 'Warp Drive', bubbleBlast: 'Bubble Blast' };
export const tierWords: Record<BoostTier, string> = { 1: 'BOOST!', 2: 'SUPER!', 3: 'MEGA!' };
export const tierBadges: Record<BoostTier, string> = { 1: 'Boost!', 2: 'Super boost!', 3: 'Mega boost!' };
export const HOLD_WORD_SECONDS = 0.9;

export interface BoostCards {
  el: HTMLElement;
  mount(parent: HTMLElement): void;
  title(theme: BoostTheme): void;
  hideTitle(): void;
  count(value: number): void;
  go(): void;
  word(tier: BoostTier): void;
  // `aside` moves the badge to the left third, clear of the hub, for rounds where the hub is back on screen showing the crew's arrival.
  badge(tier: BoostTier, aside: boolean): void;
  hideBadge(): void;
}

// The big words of a boost round: BOOST ROUND! card, 3-2-1-GO, the tier word cards and the closing tier badge. Every card is decorative; the polite live region says the same in words.
// Cards only move by transform and opacity; calm modes fade instead of slamming.
export function createBoostCards(): BoostCards {
  const el = document.createElement('div');
  el.className = 'sp-bcards';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<p class="sp-btitle" hidden>BOOST ROUND!</p><p class="sp-btheme" hidden></p><p class="sp-bcount" hidden></p><p class="sp-bword" hidden></p><p class="sp-bbadge" hidden></p>';
  const [title, theme, count, word, badge] = [...el.children] as HTMLElement[];
  const show = (target: HTMLElement, from: gsap.TweenVars, to: gsap.TweenVars): void => {
    target.hidden = false;
    if (isCalm()) gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'transform', overwrite: 'auto' });
    else gsap.fromTo(target, from, { ...to, overwrite: 'auto' });
  };
  const hide = (target: HTMLElement, vars: gsap.TweenVars = {}): void => {
    gsap.killTweensOf(target);
    gsap.to(target, { opacity: 0, duration: 0.3, ...(isCalm() ? {} : vars), onComplete: () => { target.hidden = true; } });
  };
  return {
    el,
    mount(parent) { parent.append(el); },
    title(name) {
      theme.textContent = themeNames[name];
      show(title, { scale: 1.7, opacity: 0, rotation: -8 }, { scale: 1, opacity: 1, rotation: -3, duration: 0.5, ease: 'back.out(2)', delay: 0.35 });
      show(theme, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.75 });
    },
    hideTitle() { hide(title, { y: -30 }); hide(theme, { y: -20 }); },
    count(value) {
      count.textContent = String(value);
      show(count, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)' });
    },
    go() {
      count.textContent = 'GO!';
      show(count, { scale: 0.6, opacity: 0 }, { scale: 1.1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)' });
      gsap.delayedCall(0.6, () => hide(count, { scale: 1.6 }));
    },
    word(tier) {
      word.textContent = tierWords[tier];
      gsap.killTweensOf(word);
      word.hidden = false;
      if (isCalm()) {
        gsap.fromTo(word, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: 'transform' });
        gsap.to(word, { opacity: 0, duration: 0.3, delay: HOLD_WORD_SECONDS, onComplete: () => { word.hidden = true; } });
        return;
      }
      gsap.timeline({ onComplete: () => { word.hidden = true; } })
        .fromTo(word, { scale: 1.4, opacity: 0, rotation: -6 }, { scale: 1, opacity: 1, rotation: -6, duration: 0.4, ease: 'elastic.out(1,0.5)' })
        .to(word, { y: -50, opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.4 + HOLD_WORD_SECONDS);
    },
    badge(tier, aside) {
      badge.textContent = tierBadges[tier];
      badge.classList.toggle('is-aside', aside);
      show(badge, { scale: 0.3, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2.2)' });
    },
    hideBadge() { hide(badge, { y: -30 }); },
  };
}
