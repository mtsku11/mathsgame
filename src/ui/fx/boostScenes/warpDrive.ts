import { gsap } from 'gsap';
import type { Application, Container, ImageSource, Particle, Sprite, Texture } from 'pixi.js';
import type { ZoomBlurFilter } from 'pixi-filters/zoom-blur';
import type { BoostTier } from '../../../app/events';
import { ARRIVE_BEFORE_END_MS, payoffMs } from '../../../game/boost';
import { mothership } from '../../art/mothership';
import { isCalm } from '../motion';
import { trail } from '../particles';
import { stagePoint } from '../../stage';
import { requestRender } from '../pixi';
import type { BoostScene, SceneContext } from './scene';

const CENTRE = { x: 640, y: 315 };
const VANISH = { x: 640, y: 330 };
const SHIP_SCALE = 1.8;
const STREAK = { w: 128, h: 8 };
const DOT = 32;
const MAX_RADIUS = 830;
const calmPalette = [0xFFFFFF, 0xAEEFFF, 0xFFD3A6];
const counts: Record<string, number> = { high: 460, medium: 300, low: 160 };
// How far each finale pushes the star field: peak speed in px/s, share of streaks drawn, how far the ship shrinks, and the word on the card.
const finales: Record<BoostTier, { speed: number; density: number; shrink: number; word: string; ring: number }> = {
  1: { speed: 900, density: 0.4, shrink: 0.7, word: 'WARP JUMP!', ring: 0 },
  2: { speed: 1600, density: 0.7, shrink: 0.45, word: 'WARP SPEED!', ring: 0.5 },
  3: { speed: 2500, density: 1, shrink: 0.17, word: 'HYPERSPACE!', ring: 0.85 },
};
const bgr = (rgb: number): number => (((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0;

interface Assets { pixi: typeof import('pixi.js'); source: ImageSource; whole: Texture; streak: Texture; dot: Texture; ring: Texture; flare: Texture }
const assets = new WeakMap<Application, Promise<Assets>>();

function draw(width: number, height: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d')!);
  return canvas;
}

// White shapes, tinted per particle: one atlas for the star field (a streak with a fading tail, and a soft dot), plus a ring and a flare drawn as their own sprites.
function loadAssets(app: Application): Promise<Assets> {
  let entry = assets.get(app);
  if (!entry) {
    entry = (async () => {
      const pixi = await import('pixi.js');
      const atlas = draw(160, 48, g => {
        const tail = g.createLinearGradient(0, 0, STREAK.w, 0);
        tail.addColorStop(0, 'rgba(255,255,255,0)'); tail.addColorStop(0.7, 'rgba(255,255,255,.55)'); tail.addColorStop(1, '#fff');
        g.fillStyle = tail; g.beginPath(); g.roundRect(0, 0, STREAK.w, STREAK.h, 4); g.fill();
        const dot = g.createRadialGradient(16, 32, 0, 16, 32, 16);
        dot.addColorStop(0, '#fff'); dot.addColorStop(0.5, 'rgba(255,255,255,.8)'); dot.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = dot; g.fillRect(0, 16, DOT, DOT);
      });
      const ring = draw(256, 256, g => {
        const band = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.74, 'rgba(255,255,255,0)'); band.addColorStop(0.9, 'rgba(255,255,255,1)'); band.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = band; g.fillRect(0, 0, 256, 256);
      });
      const flare = draw(128, 128, g => {
        const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        glow.addColorStop(0, 'rgba(255,251,224,1)'); glow.addColorStop(0.3, 'rgba(255,226,120,.75)'); glow.addColorStop(1, 'rgba(255,210,63,0)');
        g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
      });
      const make = async (canvas: HTMLCanvasElement): Promise<ImageSource> => new pixi.ImageSource({ resource: await createImageBitmap(canvas), resolution: 1 });
      const [source, ringSource, flareSource] = await Promise.all([make(atlas), make(ring), make(flare)]);
      return {
        pixi, source, whole: new pixi.Texture({ source }),
        streak: new pixi.Texture({ source, frame: new pixi.Rectangle(0, 0, STREAK.w, STREAK.h) }), dot: new pixi.Texture({ source, frame: new pixi.Rectangle(0, 16, DOT, DOT) }),
        ring: new pixi.Texture({ source: ringSource }), flare: new pixi.Texture({ source: flareSource }),
      };
    })();
    assets.set(app, entry);
  }
  return entry;
}

interface Sim { drift: number; radial: number; speed: number; streak: number; density: number; tunnel: number }
interface Field { warp: Container; flare: Sprite; ring: Sprite; zoom: ZoomBlurFilter | null; step(dt: number, time: number): void; destroy(): void }

// The Pixi half of Warp Drive: a star field that drifts, then streaks out from the ship, then rushes into a tunnel, plus the launch flare and shockwave ring.
// Streaks are pooled particles in one draw call; the field only ever reads the `sim` numbers that GSAP tweens.
async function buildField(app: Application, context: SceneContext, sim: Sim, isAlive: () => boolean): Promise<Field | null> {
  const a = await loadAssets(app);
  if (!isAlive()) return null;
  const { pixi } = a;
  const level = (app.canvas as HTMLCanvasElement).dataset.quality ?? 'high';
  const total = counts[level] ?? counts.high;
  const drifting = Math.round(total * 0.3);
  const warp = new pixi.Container();
  const container = new pixi.ParticleContainer({ texture: a.whole, dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true } });
  const stars: Particle[] = [];
  const px = new Float32Array(total), py = new Float32Array(total), depth = new Float32Array(total), angle = new Float32Array(total), radius = new Float32Array(total);
  const cos = new Float32Array(total), sin = new Float32Array(total), colour = new Uint32Array(total);
  const tunnelColours = [...context.colours, 0xFFFFFF, 0xFFD23F];
  const recycle = (i: number, fresh: boolean): void => {
    angle[i] = Math.random() * Math.PI * 2;
    cos[i] = Math.cos(angle[i]); sin[i] = Math.sin(angle[i]);
    radius[i] = fresh ? Math.random() * MAX_RADIUS : 20 + Math.random() * 140;
    depth[i] = 0.3 + Math.random() * 0.7;
  };
  for (let i = 0; i < total; i++) {
    const dot = i < drifting;
    if (dot) { px[i] = Math.random() * 1280; py[i] = Math.random() * 720; depth[i] = 0.3 + Math.random() * 0.7; } else recycle(i, true);
    colour[i] = bgr(calmPalette[i % calmPalette.length]);
    const particle = new pixi.Particle({ texture: dot ? a.dot : a.streak, anchorX: dot ? 0.5 : 1, anchorY: 0.5, x: px[i], y: py[i] });
    if (dot) { particle.scaleX = particle.scaleY = (1.4 + depth[i] * 2.4) / DOT; }
    stars.push(particle);
    container.addParticle(particle);
  }
  const flare = new pixi.Sprite(a.flare);
  flare.anchor.set(0.5); flare.position.set(CENTRE.x, CENTRE.y); flare.alpha = 0; flare.blendMode = 'add';
  const ring = new pixi.Sprite(a.ring);
  ring.anchor.set(0.5); ring.position.set(CENTRE.x, CENTRE.y); ring.alpha = 0; ring.scale.set(0.1); ring.blendMode = 'add';
  warp.addChild(container, ring, flare);
  // The zoom blur is the costliest pass, so it exists only at the highest quality level; it loads with the pixi-filters chunk.
  let zoom: ZoomBlurFilter | null = null;
  if (level === 'high') {
    try {
      const { ZoomBlurFilter } = await import('pixi-filters/zoom-blur');
      zoom = new ZoomBlurFilter({ strength: 0, center: { x: VANISH.x, y: VANISH.y }, innerRadius: 70 });
      zoom.resolution = 0.5;
    } catch (error) { console.warn('Zoom blur unavailable; continuing without it.', error); }
  }
  if (!isAlive()) { warp.destroy({ children: true }); return null; }
  app.stage.addChildAt(warp, 0);
  let cycle = 0;
  let tinted = false;
  const field: Field = {
    warp, flare, ring, zoom,
    step(dt, time) {
      cycle = Math.floor(time * 3);
      // Streaks are cool white until the tunnel opens, then take the pilots' colours and cycle through them.
      if (sim.tunnel > 0.3 !== tinted) {
        tinted = sim.tunnel > 0.3;
        const palette = tinted ? tunnelColours : calmPalette;
        for (let i = drifting; i < total; i++) colour[i] = bgr(palette[i % palette.length]);
      }
      const dotAlpha = 1 - sim.tunnel * 0.85;
      const rushing = sim.radial > 0.002;
      const cx = CENTRE.x + (VANISH.x - CENTRE.x) * sim.tunnel, cy = CENTRE.y + (VANISH.y - CENTRE.y) * sim.tunnel;
      const visibleStreaks = Math.round((total - drifting) * sim.density);
      for (let i = 0; i < drifting; i++) {
        py[i] += (16 + 60 * sim.drift) * depth[i] * dt;
        if (py[i] > 730) { py[i] = -10; px[i] = Math.random() * 1280; }
        const p = stars[i];
        p.y = py[i];
        p.color = (bgr(0xFFFFFF) + ((Math.round(255 * (0.3 + 0.6 * depth[i]) * dotAlpha)) << 24)) >>> 0;
      }
      for (let i = drifting; i < total; i++) {
        const p = stars[i];
        if (!rushing || i - drifting >= visibleStreaks) { if (p.color >>> 24) p.color = 0; continue; }
        const speed = sim.speed * (0.35 + 0.65 * depth[i]);
        radius[i] += speed * dt;
        if (radius[i] > MAX_RADIUS) {
          recycle(i, false);
          const palette = sim.tunnel > 0.5 ? tunnelColours : calmPalette;
          colour[i] = bgr(palette[(i + cycle) % palette.length]);
        }
        const r = radius[i];
        p.x = cx + cos[i] * r; p.y = cy + sin[i] * r; p.rotation = angle[i];
        p.scaleX = (10 + sim.streak * speed * 0.11) / STREAK.w;
        p.scaleY = (1.6 + depth[i] * 3.2 * (0.6 + r / 900)) / STREAK.h;
        p.color = (colour[i] + ((Math.round(255 * Math.min(1, sim.radial * Math.min(1, r / 200) * (0.6 + 0.55 * depth[i])))) << 24)) >>> 0;
      }
    },
    destroy() {
      warp.filters = [];
      warp.removeFromParent();
      // The atlas textures are shared and outlive the scene; only this scene's display objects go.
      warp.destroy({ children: true });
    },
  };
  return field;
}

export function createWarpDriveScene(): BoostScene {
  let context: SceneContext | null = null;
  let root: HTMLElement | null = null;
  let ship: HTMLElement | null = null;
  let glow: HTMLElement | null = null;
  let tunnel: HTMLElement | null = null;
  let flames: HTMLElement | null = null;
  let card: HTMLElement | null = null;
  let field: Field | null = null;
  let alive = false;
  let paused = false;
  let finaleStarted = false;
  let clock = 0;
  let trailClock = 0;
  let trailPoints: { x: number; y: number }[] = [];
  let flicker: gsap.core.Tween | null = null;
  let finish: (() => void) | null = null;
  const sim: Sim = { drift: 0.15, radial: 0, speed: 0, streak: 0, density: 0, tunnel: 0 };

  const tick = (): void => {
    if (!alive || paused || !field) return;
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    clock += dt;
    field.step(dt, clock);
    if (sim.tunnel > 0.5 && context) {
      trailClock += dt;
      if (trailClock > 0.09) {
        trailClock = 0;
        trailPoints.forEach((at, i) => trail(at.x, at.y, { colours: [context!.colours[i]], size: [12, 22], life: [0.4, 0.7] }));
      }
    }
    requestRender();
  };

  const scene: BoostScene = {
    target: CENTRE,
    mount(next) {
      context = next;
      alive = true;
      const ships = mothership(200).replaceAll('sp-core-', 'sp-bcore-');
      root = document.createElement('div');
      root.className = 'sp-wd';
      root.innerHTML = `<div class="sp-wd-tunnel"></div><div class="sp-wd-glow"></div>
<div class="sp-wd-ship"><svg class="sp-wd-flames" viewBox="0 0 200 90" width="200" height="90" aria-hidden="true">${[62, 138].map(x => `<g transform="translate(${x} 0)"><path d="M-11 0 Q0 84 11 0Z" fill="#FFD23F"/><path d="M-5 0 Q0 48 5 0Z" fill="#fff"/></g>`).join('')}</svg>${ships}</div>`;
      next.world.append(root);
      tunnel = root.querySelector('.sp-wd-tunnel');
      glow = root.querySelector('.sp-wd-glow');
      ship = root.querySelector('.sp-wd-ship');
      flames = root.querySelector('.sp-wd-flames');
      const number = root.querySelector<SVGTextElement>('.sp-bcore-num');
      if (number) { number.textContent = String(next.stars); number.setAttribute('font-size', String(next.stars).length > 1 ? '46' : '56'); }
      card = document.createElement('p');
      card.className = 'sp-bgiant is-hyper';
      card.hidden = true;
      next.top.append(card);
      gsap.set(ship, { scale: SHIP_SCALE, transformOrigin: '50% 50%' });
      gsap.set(flames, { opacity: 0, transformOrigin: '50% 0%' });
      gsap.set(glow, { opacity: 0.15, scale: 0.75 });
      if (next.fx && !isCalm()) {
        const app = next.fx;
        void buildField(app, next, sim, () => alive).then(built => {
          if (!built) return;
          if (!alive) { built.destroy(); return; }
          field = built;
          gsap.ticker.add(tick);
          requestRender();
        }).catch(error => console.warn('Warp star field unavailable; continuing without it.', error));
      }
    },
    onPress(_player, progress) {
      if (!ship || !glow || finaleStarted) return;
      gsap.to(glow, { opacity: 0.15 + 0.6 * progress, scale: 0.75 + 0.5 * progress, duration: 0.12, overwrite: 'auto' });
      if (isCalm()) return;
      gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(ship, { scale: SHIP_SCALE * 1.03, duration: 0.08, ease: 'power2.out' })
        .to(ship, { scale: SHIP_SCALE, duration: 0.12, ease: 'power2.in' });
    },
    onTier(tier) {
      if (!flames || finaleStarted) return;
      if (tier === 1) {
        gsap.to(flames, { opacity: 1, duration: 0.4 });
        if (!isCalm()) flicker = gsap.to(flames, { scaleY: 1.12, duration: 0.125, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(sim, { drift: 1, duration: 1.2 });
      } else if (tier === 2) {
        gsap.to(sim, { radial: 0.6, speed: 240, streak: 0.5, density: 0.55, duration: 0.9, ease: 'power1.out' });
        gsap.to(sim, { drift: 1.8, duration: 1 });
      }
    },
    playFinale(tier) {
      const current = context;
      if (!current || !ship || !glow || !tunnel || !card || finaleStarted) return Promise.resolve();
      finaleStarted = true;
      flicker?.kill();
      const plan = finales[tier];
      const payoff = payoffMs('warpDrive', tier) / 1000;
      const arrive = payoff - ARRIVE_BEFORE_END_MS / 1000;
      const rush = arrive - 0.3;
      card.textContent = plan.word;
      card.hidden = false;
      const tl = gsap.timeline();
      tl.to(glow, { opacity: 1, scale: 1.4, duration: 0.25, ease: 'power2.out' }, 0);
      const f = field;
      if (isCalm() || !f) {
        // Calm, or no effects layer: the same information as a soft fade. The ship glows, the word appears, the view dims to violet and clears as the crew arrives.
        tl.to(tunnel, { opacity: 0.55, duration: 0.7, ease: 'sine.inOut' }, 0.15)
          .fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.5)
          .to(card, { opacity: 0, duration: 0.5 }, Math.max(1, arrive - 0.5))
          .to(tunnel, { opacity: 0, duration: 0.8 }, arrive)
          .to(ship, { opacity: 0, duration: 0.5 }, arrive)
          .to(glow, { opacity: 0, duration: 0.6 }, arrive);
        if (!isCalm()) tl.to(ship, { scale: SHIP_SCALE * plan.shrink, duration: rush, ease: 'power2.in' }, 0.3);
      } else {
        trailPoints = current.saucers.map(saucer => { const at = stagePoint(saucer); return { x: at.x, y: 640 }; });
        if (tier === 3) {
          current.shake(6, 0.32);
          tl.to(f.flare, { alpha: 0.55, duration: 0.09, ease: 'power2.out' }, 0)
            .to(f.flare.scale, { x: 4.4, y: 4.4, duration: 0.25, ease: 'power2.out' }, 0)
            .to(f.flare, { alpha: 0, duration: 0.16, ease: 'power1.in' }, 0.09);
        }
        if (plan.ring) {
          tl.fromTo(f.ring, { alpha: plan.ring }, { alpha: 0, duration: 0.6, ease: 'power1.in' }, 0)
            .fromTo(f.ring.scale, { x: 0.1, y: 0.1 }, { x: 5.9, y: 5.9, duration: 0.6, ease: 'power2.out' }, 0);
        }
        tl.to(tunnel, { opacity: tier === 3 ? 1 : tier === 2 ? 0.75 : 0.5, duration: 0.75, ease: 'sine.inOut' }, 0.15)
          .to(sim, { tunnel: 1, duration: 0.6 }, 0.3)
          .to(sim, { radial: 1, density: plan.density, streak: 1, duration: 0.6, ease: 'power1.out' }, 0.3)
          .fromTo(sim, { speed: 500 }, { speed: plan.speed, duration: rush, ease: 'power1.in', immediateRender: false }, 0.3)
          .to(ship, { scale: SHIP_SCALE * plan.shrink, y: VANISH.y - CENTRE.y, duration: rush, ease: 'power2.in' }, 0.3)
          .fromTo(card, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, 0.6)
          .to(card, { opacity: 0, duration: 0.35 }, arrive - 0.25)
          .to(sim, { speed: 240, streak: 0.4, duration: 1, ease: 'power2.out' }, arrive)
          .to(sim, { radial: 0, tunnel: 0, duration: 1, ease: 'power1.in' }, arrive + 0.15)
          .to(tunnel, { opacity: 0, duration: 1, ease: 'sine.inOut' }, arrive)
          .to(ship, { opacity: 0, duration: 0.4 }, arrive);
        if (f.zoom) {
          const filter = f.zoom;
          f.warp.filters = [filter];
          tl.fromTo(filter, { strength: 0 }, { strength: 0.085, duration: 1.1, ease: 'sine.inOut' }, 0.6)
            .to(filter, { strength: 0.03, duration: Math.max(0.4, arrive - 1.7), ease: 'none' }, 1.7)
            .to(filter, { strength: 0, duration: 0.8, ease: 'sine.inOut' }, arrive)
            .call(() => { f.warp.filters = []; }, [], arrive + 0.8);
        }
        current.saucers.forEach((saucer, i) => {
          tl.to(saucer, { rotation: i % 2 ? 7 : -7, duration: 0.5, ease: 'sine.inOut' }, 0.35)
            .to(saucer, { rotation: 0, duration: 0.6, ease: 'sine.inOut' }, arrive);
        });
      }
      tl.to({}, { duration: payoff }, 0);
      return new Promise(resolve => { finish = resolve; tl.eventCallback('onComplete', () => { finish = null; resolve(); }); });
    },
    setPaused(next) { paused = next; },
    unmount() {
      alive = false;
      finish?.();
      finish = null;
      gsap.ticker.remove(tick);
      const targets = [sim, ship, glow, tunnel, flames, card, ...(context?.saucers ?? [])].filter(Boolean) as gsap.TweenTarget[];
      gsap.killTweensOf(targets);
      if (field) { gsap.killTweensOf([field.flare, field.flare.scale, field.ring, field.ring.scale, field.zoom]); field.destroy(); requestRender(); field = null; }
      context?.saucers.forEach(saucer => gsap.set(saucer, { clearProps: 'transform' }));
      root?.remove();
      card?.remove();
      root = ship = glow = tunnel = flames = card = null;
      context = null;
    },
  };
  return scene;
}
