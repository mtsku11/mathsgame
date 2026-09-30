import { gsap } from 'gsap';
import type { BoostTier } from '../../../app/events';
import { payoffMs } from '../../../game/boost';
import { fireworkSymbols, glitterField, horizon, starPoint } from '../../art/fireworks';
import { destinationOf } from '../../art/planets';
import { saucerCentres, SAUCER_TOP } from '../../components/saucer';
import { isCalm } from '../motion';
import { burst, particleStats, pattern, rand, trail } from '../particles';
import type { ParticleSpec } from '../particleSim';
import { qualityLevels } from '../pixi';
import type { BoostScene, Point, SceneContext } from './scene';

const SVG = 'http://www.w3.org/2000/svg';
const MAX_ROCKETS = 10;
const FACE = { x: 640, y: 250 };
const words: Record<BoostTier, string> = { 1: 'BOOST!', 2: 'SUPER BOOST!', 3: 'MEGA BOOST!' };
type Kind = 'star' | 'peony' | 'ring' | 'crackle' | 'willow' | 'face';
type Rocket = { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; colour: number; kind: Kind; radius: number; ember: number };

const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;
const lighten = (colour: number, amount: number): number => {
  const mix = (shift: number): number => Math.round(((colour >> shift) & 255) + (255 - ((colour >> shift) & 255)) * amount);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const GOLD = [0xFFD23F, 0xFFE58A, 0xFFF6C9];

// Firework Frenzy: every press sends a rocket from that pupil's saucer into the night sky over the planet the crew is visiting, and it opens into a shell in their colour.
// The Pixi particles do the fireworks; the horizon and the word card are DOM. Calm modes (reduced motion, low stimulation, no effects layer) show the same shells as
// static bursts that fade in and out, with no travel.
export function createFireworkFrenzyScene(): BoostScene {
  let context: SceneContext | null = null;
  let root: HTMLElement | null = null;
  let card: HTMLElement | null = null;
  let still: SVGSVGElement | null = null;
  let share = 1;
  let alive = false;
  let paused = false;
  let finaleStarted = false;
  let tier = 0;
  let clock = 0;
  let shells = 0;
  let calmClock = -1;
  let calmSlot = 0;
  let finish: (() => void) | null = null;
  let centres: number[] = [];
  let rockets: Rocket[] = [];
  let queue: { at: number; run: () => void }[] = [];
  let ctx: gsap.Context | null = null;

  const calm = (): boolean => isCalm() || !context?.fx || !particleStats().ready;
  const publish = (): void => { if (root) root.dataset.rockets = String(rockets.length); };
  // Bursts thin out when the particle pool is filling up, so the pool never refuses the last particles of a shell halfway through its outline.
  const crowd = (): number => { const s = particleStats(); return clamp((s.cap - s.alive) / Math.max(1, s.cap * 0.35), 0.3, 1); };
  const colourOf = (player: number): number => context?.colours[player] ?? 0xFFD23F;

  function spark(dx: number, dy: number, x: number, y: number, tint: number, options: Partial<ParticleSpec> & { drag: number }): ParticleSpec {
    return { x, y, vx: dx * options.drag, vy: dy * options.drag, life: 1.4, size: 14, endSize: 6, gravity: 70, fadeFrom: 0.36, tint, shape: 'dot', spin: 0, rotation: rand() * 3, ...options };
  }

  // A shell opens at (x, y). Particles start at the centre with a velocity of distance x drag, so drag brings each one to rest at its own place on the outline.
  function shell(kind: Kind, x: number, y: number, colour: number, radius: number): void {
    const k = share * crowd();
    const pale = lighten(colour, 0.55);
    shells++;
    if (kind === 'star') {
      pattern(Math.round(56 * k), (i, n) => {
        const f = i / n, outer = f < 0.72, p = starPoint(outer ? f / 0.72 : (f - 0.72) / 0.28, 1, 0.45), s = outer ? radius : radius * 0.5;
        return spark(p.x * s, p.y * s, x, y, outer ? colour : 0xFFFFFF, { drag: 2.2, size: outer ? 17 + rand() * 3 : 14, shape: outer && i % 2 ? 'star' : 'dot', spin: 3 });
      });
    } else if (kind === 'peony') {
      pattern(Math.round(66 * k), () => {
        const a = rand() * Math.PI * 2, r = radius * (0.45 + 0.55 * Math.sqrt(rand())), roll = rand();
        return spark(Math.cos(a) * r, Math.sin(a) * r, x, y, roll < 0.6 ? colour : roll < 0.88 ? pale : 0xFFFFFF, { drag: 2.1, size: 14 + rand() * 6, shape: rand() < 0.25 ? 'sparkle' : 'dot', spin: 5 });
      });
    } else if (kind === 'ring') {
      pattern(Math.round(46 * k), (i, n) => {
        const f = i / n, outer = f < 0.78, a = (outer ? f / 0.78 : (f - 0.78) / 0.22) * Math.PI * 2, r = outer ? radius : radius * 0.5;
        return spark(Math.cos(a) * r, Math.sin(a) * r, x, y, outer ? colour : pale, { drag: 2.2, size: outer ? 18 : 14, gravity: 50 });
      });
    } else if (kind === 'crackle') {
      pattern(Math.round(56 * k), () => {
        const a = rand() * Math.PI * 2, r = radius * 0.92 * Math.sqrt(rand()), roll = rand();
        return spark(Math.cos(a) * r, Math.sin(a) * r, x, y, roll < 0.5 ? 0xFFFFFF : roll < 0.8 ? GOLD[0] : colour, { drag: 2.6, size: 15 + rand() * 8, shape: 'sparkle', life: 1.7, gravity: 40, spin: 14 });
      });
    } else if (kind === 'willow') {
      pattern(Math.round(48 * k), () => {
        const a = rand() * Math.PI * 2, r = radius * (0.5 + 0.5 * rand());
        return spark(Math.cos(a) * r, Math.sin(a) * r, x, y, rand() < 0.75 ? GOLD[Math.floor(rand() * 2)] : pale, { drag: 1.15, size: 13 + rand() * 5, endSize: 5, life: 2.3, gravity: 230, fadeFrom: 0.3, shape: rand() < 0.35 ? 'sparkle' : 'dot', spin: 4 });
      });
    } else {
      starFace(x, y);
    }
    // A short white glint at the centre of every shell.
    burst(x, y, { count: 4, colours: [0xFFFFFF, pale], shapes: ['star'], size: [18, 26], speed: [0, 30], life: [0.2, 0.35], gravity: 0, drag: 3 });
  }

  // The giant star-face shell: a fat golden star outline with two eyes and a smile inside it, held in place while the shell hangs.
  function starFace(cx: number, cy: number): void {
    const eyes = [-52, 52];
    pattern(Math.round(104 * share * crowd()), (i, n) => {
      const f = i / n;
      let dx: number, dy: number, tint = 0xFFFFFF, size = 15, shape: ParticleSpec['shape'] = 'dot';
      if (f < 0.44) { const p = starPoint(f / 0.44, 190, 0.56); dx = p.x; dy = p.y; tint = GOLD[i % 2]; size = 17; if (i % 3 === 0) shape = 'star'; }
      // Each eye is a disc filled by a sunflower spiral.
      else if (f < 0.72) { const g = (f - 0.44) / 0.28, side = g < 0.5 ? 0 : 1, r = 19 * Math.sqrt((g * 2) % 1); dx = eyes[side] + Math.cos(i * 2.39996) * r; dy = -24 + Math.sin(i * 2.39996) * r; size = 15; }
      else { const t = (f - 0.72) / 0.28, u = 1 - t; dx = -76 * u * u + 76 * t * t; dy = 28 * u * u + 124 * u * t + 28 * t * t; size = 15; }
      return spark(dx, dy, cx, cy, tint, { drag: 3.5, size, endSize: size, gravity: 0, life: 2.1, fadeFrom: 0.62, shape });
    });
  }

  function explode(rocket: Rocket): void {
    shell(rocket.kind, rocket.x1, rocket.y1, rocket.colour, rocket.radius);
  }

  function fire(rocket: Rocket): void { rockets.push(rocket); publish(); }

  let cycle = 0;
  const liveKind = (): Kind => tier >= 2 ? (['peony', 'ring', 'crackle'] as const)[cycle++ % 3] : 'star';

  function launch(player: number): void {
    const x0 = centres[player] ?? 640, colour = colourOf(player);
    if (rockets.length >= MAX_ROCKETS) {
      burst(x0, SAUCER_TOP + 4, { count: 6, colours: [colour, 0xFFFFFF], shapes: ['sparkle'], size: [10, 16], speed: [90, 220], life: [0.3, 0.5], gravity: 120, angle: -Math.PI / 2, spread: 1.4 });
      return;
    }
    burst(x0, SAUCER_TOP + 4, { count: 3, colours: [colour, 0xFFFFFF], shapes: ['sparkle'], size: [10, 14], speed: [40, 120], life: [0.2, 0.35], gravity: 40, angle: -Math.PI / 2, spread: 1 });
    fire({ x0, y0: SAUCER_TOP + 6, x1: clamp(x0 + (640 - x0) * 0.3 + (rand() - 0.5) * 420, 90, 1190), y1: 175 + rand() * 175, t: 0, dur: 0.4 + rand() * 0.2, colour, kind: liveKind(), radius: (tier >= 2 ? 105 : 92) + rand() * 25, ember: 0 });
  }

  const tick = (): void => {
    if (!alive || paused) return;
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    clock += dt;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= clock) { const [entry] = queue.splice(i, 1); entry.run(); }
    if (!rockets.length) return;
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = 1 - (1 - r.t) * (1 - r.t), x = r.x0 + (r.x1 - r.x0) * e + Math.sin(r.t * 9) * 4 * (1 - r.t), y = r.y0 + (r.y1 - r.y0) * e;
      burst(x, y, { count: 1, colours: [r.colour, 0xFFFFFF], shapes: ['star'], size: [20, 28], speed: [0, 8], life: [0.06, 0.09], gravity: 0, spread: 0 });
      r.ember -= dt;
      while (r.ember <= 0) { r.ember += 0.055; trail(x, y, { colours: [r.colour, 0xFFD23F], size: [8, 14], life: [0.35, 0.55] }); }
      if (r.t >= 1) { rockets.splice(i, 1); explode(r); }
    }
    publish();
  };

  const later = (delay: number, run: () => void): void => { queue.push({ at: clock + delay, run }); };

  // The finale's rockets: bigger shells spread across the whole sky, leaving every saucer in turn in all the pilots' colours.
  function wave(count: number, span: number, kinds: Kind[], seed: number): void {
    for (let i = 0; i < count; i++) {
      later(span * i / count, () => {
        const player = i % Math.max(1, centres.length), x0 = centres[player] ?? 640;
        fire({ x0, y0: SAUCER_TOP + 6, x1: 110 + ((i * 0.618 + seed) % 1) * 1060, y1: 90 + ((i * 0.37 + seed * 2) % 1) * 270, t: 0, dur: 0.42 + rand() * 0.16, colour: colourOf(player),
          kind: kinds[(i + Math.floor(seed * 10)) % kinds.length], radius: 110 + rand() * 40, ember: 0 });
      });
    }
  }

  // Golden glitter that falls all the way across the screen: `chunks` small showers spread over `span` seconds, from just above the top edge.
  function glitter(start: number, span: number): void {
    const chunks = 9;
    for (let c = 0; c < chunks; c++) {
      later(start + span * c / chunks, () => pattern(Math.round(34 * share), () => ({
        x: rand() * 1280, y: -20 - rand() * 60, vx: (rand() - 0.5) * 70, vy: 240 + rand() * 160, life: 1.9 + rand() * 0.3, size: 10 + rand() * 8, endSize: 6, rotation: rand() * 6, spin: (rand() - 0.5) * 8,
        gravity: 190, drag: 0.2, fadeFrom: 0.75, tint: GOLD[Math.floor(rand() * 3)], shape: (['sparkle', 'dot', 'star'] as const)[Math.floor(rand() * 3)],
      })));
    }
  }

  // ---- calm variant: static bursts --------------------------------------------------------------------------------------------------------------------

  function stillLayer(): SVGSVGElement {
    if (!still && root) {
      still = document.createElementNS(SVG, 'svg');
      still.setAttribute('class', 'sp-fw-static');
      still.setAttribute('viewBox', '0 0 1280 720');
      still.setAttribute('aria-hidden', 'true');
      still.innerHTML = fireworkSymbols();
      root.append(still);
    }
    return still!;
  }

  function staticBurst(kind: 'star' | 'peony' | 'ring' | 'face', x: number, y: number, size: number, colour: number, delay: number, hold: number): void {
    const layer = stillLayer();
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', `#sp-fw-${kind}`);
    use.setAttribute('x', String(x - size / 2)); use.setAttribute('y', String(y - size / 2));
    use.setAttribute('width', String(size)); use.setAttribute('height', String(size));
    use.style.color = css(colour);
    use.style.opacity = '0';
    layer.append(use);
    ctx?.add(() => { gsap.timeline({ delay, onComplete: () => use.remove() }).to(use, { opacity: 1, duration: 0.35 }).to(use, { opacity: 0, duration: 0.6 }, 0.35 + hold); });
  }

  const slots: Point[] = [{ x: 180, y: 160 }, { x: 640, y: 130 }, { x: 1100, y: 170 }, { x: 420, y: 250 }, { x: 860, y: 240 }, { x: 260, y: 300 }, { x: 1010, y: 310 }, { x: 640, y: 290 }];
  function calmPress(player: number): void {
    // At most one new burst about every half second, so a mashing crew sees a calm sky, not a busy one.
    if (performance.now() - calmClock < 450) return;
    calmClock = performance.now();
    const at = slots[calmSlot++ % slots.length];
    staticBurst(tier >= 2 ? (calmSlot % 2 ? 'peony' : 'ring') : 'star', at.x, at.y, 190, colourOf(player), 0, 0.7);
  }

  function calmFinale(finalTier: BoostTier, seconds: number): void {
    const groups = finalTier === 3 ? [6, 8, 8] : finalTier === 2 ? [6, 6] : [6];
    const kinds: ('star' | 'peony' | 'ring')[] = finalTier === 1 ? ['star', 'peony'] : ['star', 'peony', 'ring'];
    let index = 0;
    groups.forEach((count, g) => {
      for (let i = 0; i < count; i++, index++) {
        const player = index % Math.max(1, centres.length);
        const x = 130 + ((index * 0.618 + g * 0.31) % 1) * 1020, y = 100 + ((index * 0.37 + g * 0.17) % 1) * 260;
        staticBurst(kinds[index % kinds.length], x, y, 200 + (index % 3) * 20, colourOf(player), g * 1.2 + i * 0.16, 1.1);
      }
    });
    if (finalTier === 3) {
      staticBurst('face', FACE.x, FACE.y, 400, 0xFFD23F, 3.3, 1.7);
      const glitter = document.createElementNS(SVG, 'g');
      glitter.setAttribute('opacity', '0');
      glitter.innerHTML = glitterField();
      stillLayer().append(glitter);
      ctx?.add(() => { gsap.timeline().to(glitter, { opacity: 1, duration: 0.8 }, 4.0).to(glitter, { opacity: 0, duration: 0.7 }, Math.max(5, seconds - 0.7)); });
    }
  }

  const scene: BoostScene = {
    target: FACE,
    // Rockets leave the saucer the moment the switch is pressed; there is no bolt to wait for.
    direct: true,
    mount(next) {
      context = next;
      alive = true;
      ctx = gsap.context(() => {});
      centres = saucerCentres(next.players);
      const level = (next.fx?.canvas as HTMLCanvasElement | undefined)?.dataset.quality ?? 'high';
      share = (qualityLevels[level as keyof typeof qualityLevels] ?? qualityLevels.high).particles / qualityLevels.high.particles;
      root = document.createElement('div');
      root.className = 'sp-fw';
      root.dataset.boostScene = 'fireworkFrenzy';
      root.dataset.rockets = '0';
      root.innerHTML = horizon(destinationOf(next.round) === 2 ? 'ice' : destinationOf(next.round) === 1 ? 'candy' : 'ring');
      next.world.append(root);
      card = document.createElement('p');
      card.className = 'sp-bgiant is-firework';
      card.hidden = true;
      next.top.append(card);
      gsap.ticker.add(tick);
    },
    onPress(player) {
      if (!alive || finaleStarted) return;
      if (calm()) calmPress(player); else launch(player);
    },
    onTier(next) { tier = next; },
    playFinale(finalTier) {
      const current = context;
      if (!current || !card || !alive || finaleStarted) return Promise.resolve();
      finaleStarted = true;
      tier = finalTier;
      const seconds = payoffMs('fireworkFrenzy', finalTier) / 1000;
      const label = card;
      label.textContent = words[finalTier];
      label.hidden = false;
      // The card comes in after the shells: at the star-face for MEGA, and about half way through the smaller finales.
      const cardAt = finalTier === 3 ? 3.9 : finalTier === 2 ? 2.6 : 1.3;
      const hideAt = seconds - 0.5;
      if (calm()) {
        calmFinale(finalTier, seconds);
        ctx?.add(() => { gsap.fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: cardAt }); gsap.to(label, { opacity: 0, duration: 0.5, delay: hideAt }); });
      } else {
        const kinds: Kind[] = finalTier === 3 ? ['star', 'peony', 'willow', 'ring', 'crackle'] : finalTier === 2 ? ['peony', 'ring', 'crackle', 'star'] : ['star', 'peony'];
        if (finalTier === 3) {
          wave(8, 0.9, kinds, 0.13);
          later(1.2, () => wave(10, 0.9, kinds, 0.47));
          later(2.4, () => wave(12, 1.0, kinds, 0.81));
          later(3.0, () => fire({ x0: 640, y0: SAUCER_TOP - 30, x1: FACE.x, y1: FACE.y, t: 0, dur: 0.5, colour: 0xFFD23F, kind: 'face', radius: 190, ember: 0 }));
          glitter(4.0, 1.3);
        } else {
          wave(finalTier === 2 ? 8 : 6, 1.0, kinds, 0.21);
          if (finalTier === 2) later(1.5, () => wave(10, 1.0, kinds, 0.63));
        }
        ctx?.add(() => {
          gsap.fromTo(label, { scale: 1.5, opacity: 0, rotation: -6 }, { scale: 1, opacity: 1, rotation: -3, duration: 0.45, delay: cardAt, ease: 'elastic.out(1,0.5)' });
          gsap.to(label, { opacity: 0, y: -30, duration: 0.4, delay: hideAt, ease: 'power1.in' });
        });
      }
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
      rockets = [];
      queue = [];
      root?.remove();
      card?.remove();
      root = card = still = null;
      context = null;
    },
  };
  return scene;
}
