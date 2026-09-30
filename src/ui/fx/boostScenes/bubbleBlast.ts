import { gsap } from 'gsap';
import type { BoostTier } from '../../../app/events';
import { payoffMs } from '../../../game/boost';
import { BUBBLE_BASE, bubble, gloop, gumSplat, starCluster } from '../../art/gloop';
import { isCalm } from '../motion';
import { burst, pattern, rand, particleStats } from '../particles';
import type { ParticleSpec } from '../particleSim';
import { qualityLevels } from '../pixi';
import type { BoostScene, SceneContext } from './scene';

// Gloop's mouth in stage coordinates: the bubble grows from here. His box is 300 px wide and the mouth sits at (150, 210) inside it.
const GLOOP = { left: 490, top: 200, size: 300 };
const MOUTH = { x: GLOOP.left + 150, y: GLOOP.top + 210 };
const BUBBLE = { size: 400, left: MOUTH.x - 200, top: MOUTH.y - 390 };
const RADIUS = 190;
const STRETCH = 1.08;
const pinks = [0xFF7EC8, 0xFF9AD5, 0xFFB3DD, 0xE0449C];
const sweets = [0x7CF2C5, 0xFFD23F, 0x36D6FF, 0xFF9F43, 0xC49CFF];
const splatColours = ['#FF7EC8', '#FF9AD5', '#E0449C'];
// The bubble's size as a fraction of full, for a meter fill of 0..1.
const sizeFor = (progress: number): number => 0.15 + 0.85 * Math.min(1, Math.max(0, progress));
// Where the eyes and cheeks have got to at each tier.
const puffs = [{ cheek: 1, eye: 30 }, { cheek: 1.3, eye: 33 }, { cheek: 1.55, eye: 36 }, { cheek: 1.7, eye: 36 }];
const shine = [0, 0.5, 0.85, 1];

// Bubble Blast: Gloop blows bubblegum and every bolt pumps the bubble up. At the end it POPS into gum, stars and sweets, and Gloop giggles under a coat of gum.
// The bubble, Gloop and the gum splats are DOM (GSAP); the pop's shreds, stars and sweets are Pixi particles. Calm modes swap the pop for a soft fade into a cluster of stars.
export function createBubbleBlastScene(): BoostScene {
  let context: SceneContext | null = null;
  let root: HTMLElement | null = null;
  let gloopEl: HTMLElement | null = null;
  let wobEl: HTMLElement | null = null;
  let bubbleEl: HTMLElement | null = null;
  let ringEl: HTMLElement | null = null;
  let clusterEl: HTMLElement | null = null;
  let card: HTMLElement | null = null;
  let splats: HTMLElement[] = [];
  let share = 1;
  let alive = false;
  let paused = false;
  let finaleStarted = false;
  let size = sizeFor(0);
  let fill = 0;
  let clock = 0;
  let lastPump = -1;
  let finish: (() => void) | null = null;
  let ctx: gsap.Context | null = null;
  let setWob: ((x: number, y: number, rotation: number) => void) | null = null;

  const calm = (): boolean => isCalm() || !context?.fx || !particleStats().ready;
  const parts = (selector: string): Element[] => [...(gloopEl?.querySelectorAll(selector) ?? [])];
  const centreY = (scale: number): number => MOUTH.y - RADIUS * scale;

  function pump(progress: number): void {
    if (!bubbleEl) return;
    fill = progress;
    size = sizeFor(progress);
    if (calm()) { gsap.to(bubbleEl, { scaleX: size, scaleY: size, duration: 0.15, overwrite: 'auto' }); return; }
    // Presses can come far faster than the wobble reads, so a press inside the last 90 ms only steps the size up.
    if (clock - lastPump < 0.09) { gsap.to(bubbleEl, { scaleX: size, scaleY: size, duration: 0.09, ease: 'sine.out', overwrite: 'auto' }); return; }
    lastPump = clock;
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(bubbleEl, { scaleX: size * 1.06, scaleY: size * 0.95, duration: 0.07, ease: 'power2.out' })
      .to(bubbleEl, { scaleX: size * 0.985, scaleY: size * 1.02, duration: 0.09, ease: 'sine.inOut' })
      .to(bubbleEl, { scaleX: size, scaleY: size, duration: 0.14, ease: 'sine.out' });
  }

  // The bubble trembles faster and harder as it nears full. Only the wrapper moves, so the pump's squash and stretch is untouched.
  const tick = (): void => {
    if (!alive || paused || finaleStarted || !setWob) return;
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    clock += dt;
    if (calm() || fill < 0.5) return;
    const near = (fill - 0.5) / 0.5, hz = 8 + 22 * near, amplitude = 0.6 + 2.6 * near;
    const phase = clock * hz * Math.PI * 2;
    setWob(Math.sin(phase) * amplitude, Math.cos(phase * 1.3) * amplitude * 0.5, Math.sin(phase * 0.7) * near * 0.8);
  };

  function pop(scale: number): void {
    const cy = centreY(scale), k = Math.max(0.3, Math.min(1, scale)), n = (count: number): number => Math.max(6, Math.round(count * k * share));
    const shred = (tint: number, shape: ParticleSpec['shape'], size: [number, number], speed: [number, number], life: [number, number]): ParticleSpec => {
      const a = rand() * Math.PI * 2, v = speed[0] + (speed[1] - speed[0]) * rand();
      return { x: MOUTH.x, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: life[0] + (life[1] - life[0]) * rand(), size: size[0] + (size[1] - size[0]) * rand(), endSize: size[0] * 0.7,
        rotation: rand() * 6, spin: (rand() - 0.5) * 24, gravity: 520, drag: 0.55, fadeFrom: 0.6, tint, shape };
    };
    // Gum shreds, stars and sweets: about 200 at full size.
    pattern(n(120), () => shred(pinks[Math.floor(rand() * pinks.length)], 'strip', [18, 30], [240, 820], [1.3, 2]));
    pattern(n(44), () => shred(rand() < 0.5 ? 0xFFD23F : rand() < 0.5 ? 0xFFFFFF : 0xFFB3DD, 'star', [18, 30], [200, 760], [1.2, 1.9]));
    pattern(n(40), () => shred(sweets[Math.floor(rand() * sweets.length)], 'sweet', [30, 42], [200, 700], [1.3, 2]));
    burst(MOUTH.x, cy, { count: 10, colours: [0xFFFFFF, 0xFFD23F], shapes: ['sparkle'], size: [22, 34], speed: [60, 320], life: [0.3, 0.6], gravity: 0 });
    if (ringEl) {
      const el = ringEl;
      el.hidden = false;
      gsap.set(el, { left: MOUTH.x - 150, top: cy - 150, scale: 0.25, opacity: 0 });
      // The ring's opacity ramps over several frames on the way in and out, so the pop never makes a sudden bright frame.
      gsap.timeline()
        .to(el, { opacity: 0.55, duration: 0.1, ease: 'none' }, 0)
        .to(el, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 0.1)
        .to(el, { scale: 1.5 + 3.5 * k, duration: 0.65, ease: 'power2.out' }, 0);
    }
  }

  function splat(seconds: number, tier: BoostTier): void {
    const top = context?.top;
    if (!top) return;
    const spots = [{ x: 24, y: 170, s: 150 }, { x: 1100, y: 110, s: 170 }, { x: 50, y: 400, s: 120 }, { x: 1120, y: 380, s: 140 }, { x: 320, y: 4, s: 110 }, { x: 880, y: 2, s: 120 }];
    const slide = Math.max(0.8, Math.min(2, seconds - 0.9));
    splats = spots.slice(0, tier === 3 ? 6 : tier === 2 ? 4 : 3).map((spot, i) => {
      const el = document.createElement('div');
      el.className = 'sp-bb-splat';
      el.style.left = `${spot.x}px`; el.style.top = `${spot.y}px`;
      el.innerHTML = gumSplat(spot.s, splatColours[i % 3], i);
      top.prepend(el);
      gsap.set(el, { scale: 0, opacity: 1, transformOrigin: '50% 0%' });
      ctx?.add(() => {
        gsap.timeline({ delay: 0.12 + i * 0.05 })
          .to(el, { scale: 1, duration: 0.22, ease: 'back.out(2.4)' })
          .to(el, { y: 150 + rand() * 130, scaleY: 1.5, duration: slide, ease: 'power1.in' }, 0.55)
          .to(el, { opacity: 0, duration: 0.4, ease: 'none' }, 0.55 + slide - 0.4);
      });
      return el;
    });
  }

  function expression(mode: 'happy' | 'normal', seconds = 0): void {
    const happy = mode === 'happy';
    gsap.to(parts('.gl-eyes, .gl-mouth'), { opacity: happy ? 0 : 1, duration: seconds });
    gsap.to(parts('.gl-happy, .gl-laugh'), { opacity: happy ? 1 : 0, duration: seconds });
  }

  const scene: BoostScene = {
    // Bolts land in the bubble, just above Gloop's mouth.
    target: { x: MOUTH.x, y: MOUTH.y - 50 },
    mount(next) {
      context = next;
      alive = true;
      ctx = gsap.context(() => {});
      const level = (next.fx?.canvas as HTMLCanvasElement | undefined)?.dataset.quality ?? 'high';
      share = (qualityLevels[level as keyof typeof qualityLevels] ?? qualityLevels.high).particles / qualityLevels.high.particles;
      root = document.createElement('div');
      root.className = 'sp-bb';
      root.dataset.boostScene = 'bubbleBlast';
      root.innerHTML = `<div class="sp-bb-gloop">${gloop(GLOOP.size)}</div><div class="sp-bb-wob"><div class="sp-bb-bubble">${bubble(BUBBLE.size)}</div></div>
<div class="sp-bb-cluster-wrap" hidden>${starCluster(BUBBLE.size)}</div><div class="sp-bb-ring" hidden></div>`;
      next.world.append(root);
      gloopEl = root.querySelector('.sp-bb-gloop');
      wobEl = root.querySelector('.sp-bb-wob');
      bubbleEl = root.querySelector('.sp-bb-bubble');
      ringEl = root.querySelector('.sp-bb-ring');
      clusterEl = root.querySelector('.sp-bb-cluster-wrap');
      card = document.createElement('p');
      card.className = 'sp-bgiant is-pop';
      card.textContent = 'POP!';
      card.hidden = true;
      next.top.append(card);
      const origin = `50% ${BUBBLE_BASE * 100}%`;
      gsap.set([bubbleEl, wobEl, clusterEl], { transformOrigin: origin });
      gsap.set(bubbleEl, { scaleX: size, scaleY: size });
      gsap.set(gloopEl, { transformOrigin: '50% 100%' });
      gsap.set(parts('.gl-gum'), { transformOrigin: '50% 30%' });
      const xSet = gsap.quickSetter(wobEl, 'x', 'px') as (value: number) => void, ySet = gsap.quickSetter(wobEl, 'y', 'px') as (value: number) => void, rSet = gsap.quickSetter(wobEl, 'rotation', 'deg') as (value: number) => void;
      setWob = (x, y, rotation) => { xSet(x); ySet(y); rSet(rotation); };
      if (!isCalm()) ctx.add(() => { gsap.to(gloopEl, { scaleY: 1.025, scaleX: 0.99, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }); });
      gsap.ticker.add(tick);
    },
    onPress(_player, progress) {
      if (!alive || finaleStarted) return;
      pump(progress);
    },
    onTier(tier) {
      if (!alive || finaleStarted || !gloopEl) return;
      const puff = puffs[tier], seconds = calm() ? 0 : 0.35;
      gsap.to(parts('.gl-cheek'), { attr: { rx: 16 * puff.cheek, ry: 11 * puff.cheek }, duration: seconds, ease: 'back.out(2.5)' });
      gsap.to(parts('.gl-eye'), { attr: { r: puff.eye }, duration: seconds, ease: 'back.out(2.5)' });
      gsap.to(parts('.gl-pupil'), { attr: { r: 15 + tier }, duration: seconds });
      if (bubbleEl) gsap.to(bubbleEl.querySelector('.bb-shine'), { opacity: shine[tier], duration: seconds });
      if (!calm()) gsap.fromTo(gloopEl, { scaleX: 1.07, scaleY: 0.94 }, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1,0.45)', overwrite: 'auto' });
    },
    playFinale(tier) {
      const current = context;
      if (!current || !alive || !bubbleEl || !gloopEl || !card || finaleStarted) return Promise.resolve();
      finaleStarted = true;
      const seconds = payoffMs('bubbleBlast', tier) / 1000;
      // A bubble that ran out of time pops smaller and with fewer pieces; the biggest one always pops at full size.
      if (tier === 3) size = 1;
      const bubbleNow = bubbleEl, label = card, cover = parts('.gl-gum');
      gsap.killTweensOf([bubbleEl, wobEl, gloopEl]);
      gsap.set(wobEl, { x: 0, y: 0, rotation: 0 });
      const coverAt = Math.min(0.65, seconds * 0.3), hideAt = seconds - 0.5;
      ctx?.add(() => {
        const tl = gsap.timeline();
        if (calm()) {
          // Same story without the burst: the bubble softly gives way to a small cluster of stars, Gloop is coated in gum, the word fades in and out.
          const cluster = clusterEl!;
          cluster.hidden = false;
          gsap.set(cluster, { opacity: 0, scale: 0.4 + 0.6 * size, left: BUBBLE.left, top: BUBBLE.top });
          tl.to(bubbleNow, { opacity: 0, duration: 0.6, ease: 'sine.inOut' }, 0)
            .to(cluster, { opacity: 1, duration: 0.6, ease: 'sine.inOut' }, 0.15)
            .to(cover, { opacity: 1, duration: 0.6 }, coverAt)
            .add(() => expression('happy', 0.3), coverAt)
            .fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.3)
            .to(label, { opacity: 0, duration: 0.5 }, hideAt)
            .to(cluster, { opacity: 0, duration: 0.5 }, Math.max(1, seconds - 0.6));
          label.hidden = false;
        } else {
          label.hidden = false;
          tl.to(bubbleNow, { scaleX: size * STRETCH, scaleY: size * STRETCH, duration: 0.15, ease: 'power2.out' }, 0)
            .add(() => {
              // The bubble is gone within a few frames, while the ring and the pieces are already on their way.
              gsap.to(bubbleNow, { opacity: 0, duration: 0.06, ease: 'none' });
              pop(size * STRETCH);
              splat(seconds, tier);
              current.shake(5, 0.3);
              gsap.fromTo(gloopEl, { scaleX: 1.1, scaleY: 0.88 }, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
            }, 0.15)
            .fromTo(label, { scale: 1.6, opacity: 0, rotation: -8 }, { scale: 1, opacity: 1, rotation: -4, duration: 0.45, ease: 'elastic.out(1,0.5)' }, 0.3)
            .to(label, { opacity: 0, y: -30, duration: 0.4, ease: 'power1.in' }, hideAt)
            .fromTo(cover, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, coverAt)
            .add(() => {
              expression('happy', 0.15);
              // The giggle: a quick squash and stretch that carries on to the end of the finale.
              gsap.fromTo(gloopEl, { scaleX: 1, scaleY: 1, rotation: 0 }, { scaleX: 0.95, scaleY: 1.07, rotation: 1.8, duration: 0.17, repeat: -1, yoyo: true, ease: 'sine.inOut', overwrite: 'auto' });
            }, coverAt + 0.35);
          current.saucers.forEach((saucer, i) => tl.to(saucer, { y: -22, duration: 0.2, repeat: 5, yoyo: true, ease: 'power2.out' }, 0.4 + i * 0.06));
        }
      });
      return new Promise(resolve => { finish = resolve; ctx?.add(() => { gsap.delayedCall(seconds, () => { finish = null; resolve(); }); }); });
    },
    setPaused(next) { paused = next; },
    unmount() {
      alive = false;
      finish?.();
      finish = null;
      gsap.ticker.remove(tick);
      ctx?.kill();
      ctx = null;
      if (context) context.saucers.forEach(saucer => gsap.set(saucer, { clearProps: 'transform' }));
      gsap.killTweensOf([gloopEl, wobEl, bubbleEl, ringEl, clusterEl, card, ...splats, ...parts('.gl-cheek, .gl-eye, .gl-pupil, .gl-eyes, .gl-mouth, .gl-happy, .gl-laugh, .gl-gum'), bubbleEl?.querySelector('.bb-shine')].filter(Boolean) as gsap.TweenTarget[]);
      splats.forEach(el => el.remove());
      splats = [];
      root?.remove();
      card?.remove();
      root = gloopEl = wobEl = bubbleEl = ringEl = clusterEl = card = null;
      setWob = null;
      context = null;
    },
  };
  return scene;
}
