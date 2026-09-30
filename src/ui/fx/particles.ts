import { gsap } from 'gsap';
import type { Application, Particle, ParticleContainer } from 'pixi.js';
import { ATLAS_SIZE, atlasFrames, atlasSvg } from '../art/particles';
import { isInstant, isLowStim, isReduced } from './motion';
import { getFx, particleBudget, qualityLevels, requestRender, type QualityLevel } from './pixi';
import { ParticleSim, SHAPES, between, type EmitterSpec, type ParticleShape, type ParticleSpec, type Range } from './particleSim';

export const gold = [0xFFD23F, 0xFFE58A, 0xFFFFFF];
export const crewColours = [0xFF5DA2, 0x36D6FF, 0xFF9F43, 0x9DF26B, 0xFFD23F];

export interface BurstOptions {
  count?: number; colours?: number[]; shapes?: ParticleShape[];
  speed?: Range; life?: Range; size?: Range; gravity?: number; drag?: number;
  angle?: number; spread?: number; spin?: number;
}
export interface ShowerOptions { x?: number; y?: number; width?: number; count?: number; duration?: number; colours?: number[]; life?: Range; size?: Range; fall?: Range }

const MAX_SHOWER_SECONDS = 4;
let random: () => number = Math.random;
export function seedParticles(source: () => number): void { random = source; }

let sim: ParticleSim | null = null;
let level: QualityLevel = 'high';
let attached: { app: Application; container: ParticleContainer; pool: Particle[]; textures: Record<ParticleShape, import('pixi.js').Texture>; tick: () => void } | null = null;
let atlas: Promise<HTMLCanvasElement> | null = null;
let spawnedTotal = 0;

// Every emitter call passes through here, so the cap always reflects the current quality and low-stimulation setting.
function active(): boolean {
  if (!sim || !attached || isReduced() || isInstant()) return false;
  sim.cap = particleBudget(level);
  return true;
}
const factor = (): number => isLowStim() ? 0.25 : 1;
const scaled = (count: number): number => count <= 0 ? 0 : Math.max(1, Math.round(count * factor()));
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

export const particleStats = (): { ready: boolean; alive: number; cap: number; spawned: number; enabled: boolean } =>
  ({ ready: attached !== null, alive: sim?.count ?? 0, cap: attached ? particleBudget(level) : 0, spawned: spawnedTotal, enabled: active() });

function spawn(spec: ParticleSpec): void { if (sim!.spawn(spec)) spawnedTotal++; }

// Stage coordinates (1280x720). Radial spray; a gold star-and-sparkle burst by default.
export function burst(x: number, y: number, options: BurstOptions = {}): void {
  if (!active()) return;
  const { colours = gold, shapes = ['star', 'sparkle'], speed = [140, 340], life = [0.55, 1], size = [14, 26], gravity = 260, drag = 1.6, angle = 0, spread = Math.PI * 2, spin = 7 } = options;
  const count = scaled(options.count ?? 22);
  for (let i = 0; i < count; i++) {
    const heading = angle + (random() - 0.5) * spread;
    const velocity = between(random, speed);
    spawn({ x, y, vx: Math.cos(heading) * velocity, vy: Math.sin(heading) * velocity, life: between(random, life), size: between(random, size), endSize: between(random, size) * 0.5,
      rotation: random() * Math.PI, spin: (random() - 0.5) * 2 * spin, gravity, drag, tint: pick(colours), shape: pick(shapes) });
  }
}

// One call per frame from a moving point; leaves a short fading wake.
export function trail(x: number, y: number, options: { colours?: number[]; size?: Range; life?: Range } = {}): void {
  if (!active() || random() > factor()) return;
  const { colours = gold, size = [9, 17], life = [0.3, 0.55] } = options;
  spawn({ x: x + (random() - 0.5) * 8, y: y + (random() - 0.5) * 8, vx: (random() - 0.5) * 50, vy: (random() - 0.5) * 50 + 14, life: between(random, life), size: between(random, size), endSize: 2,
    rotation: random() * Math.PI, spin: (random() - 0.5) * 6, drag: 1.4, tint: pick(colours), shape: random() < 0.6 ? 'sparkle' : 'star' });
}

function shower(options: ShowerOptions, shapes: ParticleShape[], defaults: { fall: Range; size: Range; gravity: number; flutter: boolean; colours: number[] }): void {
  if (!active()) return;
  const { x = 0, y = -30, width = 1280, colours = defaults.colours, life = [1.6, 2.1], size = defaults.size, fall = defaults.fall } = options;
  const duration = Math.min(MAX_SHOWER_SECONDS, options.duration ?? 1.9);
  // Spawning plus the longest life stays inside the four-second ceiling for a celebration.
  const longest = Math.max(0.5, MAX_SHOWER_SECONDS - duration);
  const count = scaled(options.count ?? 140);
  const spec: EmitterSpec = {
    duration, rate: count / duration,
    make: () => ({ x: x + random() * width, y: y - random() * 40, vx: (random() - 0.5) * 90, vy: between(random, fall), life: Math.min(between(random, life), longest), size: between(random, size),
      rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 9, gravity: defaults.gravity, drag: 0.55, fadeFrom: 0.8, flutter: defaults.flutter ? 6 + random() * 8 : 0, tint: pick(colours), shape: pick(shapes) }),
  };
  sim!.emit(spec);
}
export function confetti(options: ShowerOptions = {}): void {
  shower(options, ['strip', 'strip', 'star', 'dot'], { fall: [70, 190], size: [15, 24], gravity: 150, flutter: true, colours: crewColours });
}
export function rain(options: ShowerOptions = {}): void {
  shower(options, ['sparkle', 'dot', 'star'], { fall: [50, 130], size: [10, 20], gravity: 60, flutter: false, colours: gold });
}

export function clearParticles(): void { sim?.clear(); if (attached) { attached.container.particleChildren.length = 0; requestRender(); } }

function rasterise(): Promise<HTMLCanvasElement> {
  atlas ??= (async () => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(atlasSvg())}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ATLAS_SIZE * 2;
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  })();
  return atlas;
}

export async function attachParticles(app: Application, quality: QualityLevel): Promise<void> {
  detachParticles();
  try {
    const [pixi, canvas] = await Promise.all([import('pixi.js'), rasterise()]);
    if (getFx() !== app) return;
    const bitmap = await createImageBitmap(canvas);
    if (getFx() !== app) return;
    const source = new pixi.ImageSource({ resource: bitmap, resolution: 2 });
    const whole = new pixi.Texture({ source });
    const textures = Object.fromEntries(SHAPES.map(shape => {
      const { x, y, w, h } = atlasFrames[shape];
      return [shape, new pixi.Texture({ source, frame: new pixi.Rectangle(x, y, w, h) })];
    })) as Record<ParticleShape, import('pixi.js').Texture>;
    const container = new pixi.ParticleContainer({ texture: whole, dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true } });
    app.stage.addChild(container);
    level = quality;
    sim = new ParticleSim(qualityLevels.high.particles);
    sim.cap = particleBudget(quality);
    const pool: Particle[] = [];
    const tick = (): void => {
      if (!sim || !attached || getFx() !== app) { detachParticles(); return; }
      if (!sim.active && attached.container.particleChildren.length === 0) return;
      const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
      sim.cap = particleBudget(level);
      sim.step(dt);
      const children = attached.container.particleChildren as Particle[];
      const n = sim.count;
      while (children.length < n) children.push(pool[children.length] ??= new pixi.Particle({ texture: textures.dot, anchorX: 0.5, anchorY: 0.5 }));
      children.length = n;
      for (let i = 0; i < n; i++) {
        const p = children[i], shape = SHAPES[sim.shape[i]], frame = atlasFrames[shape];
        const scale = sim.scaleAt(i) / Math.max(frame.w, frame.h);
        p.texture = textures[shape];
        p.x = sim.x[i]; p.y = sim.y[i];
        p.scaleX = scale * sim.flipAt(i); p.scaleY = scale;
        p.rotation = sim.rotation[i];
        p.color = (sim.bgr[i] + ((sim.alphaAt(i) * 255 | 0) << 24)) >>> 0;
      }
      requestRender();
    };
    attached = { app, container, pool, textures, tick };
    gsap.ticker.add(tick);
  } catch (error) {
    console.warn('Particle layer unavailable; continuing without it.', error);
  }
}

export function detachParticles(): void {
  const old = attached;
  if (old) {
    gsap.ticker.remove(old.tick);
    // Pixi warns when an atlas is destroyed while the particle shader still points at it, so it leaves the stage now and is disposed once the app itself is gone.
    old.container.removeFromParent();
    queueMicrotask(() => { try { old.container.destroy({ texture: true, textureSource: true }); } catch { /* the app was already destroyed */ } });
  }
  attached = null;
  sim = null;
}
