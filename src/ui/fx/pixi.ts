import { gsap } from 'gsap';
import type { Application } from 'pixi.js';
import type { Quality } from '../../settings';
import { isInstant, isLowStim } from './motion';
import { STAGE_HEIGHT, STAGE_WIDTH, stageElement, stageScale } from '../stage';

export type QualityLevel = Exclude<Quality, 'auto'>;
export const qualityLevels: Record<QualityLevel, { resolution: number; antialias: boolean; particles: number }> = {
  high: { resolution: 2, antialias: true, particles: 2500 },
  medium: { resolution: 1.5, antialias: true, particles: 1200 },
  low: { resolution: 1, antialias: false, particles: 600 },
};
// Until the startup benchmark has run, Auto assumes a capable machine.
let measured: QualityLevel | null = null;
export const resolveQuality = (quality: Quality): QualityLevel => quality === 'auto' ? measured ?? 'high' : quality;
export interface BenchSample { workMs: number; frameMs: number }
export let lastBenchmark: (BenchSample & { level: QualityLevel }) | null = null;
// workMs: a fixed canvas workload; frameMs: the median animation-frame gap while it was idle. Either being slow drops a level.
export function pickLevel({ workMs, frameMs }: BenchSample): QualityLevel {
  if (workMs > 160 || frameMs > 28) return 'low';
  if (workMs > 100 || frameMs > 20) return 'medium';
  return 'high';
}
const frames = (count: number): Promise<number> => new Promise(resolve => {
  const times: number[] = [];
  // The median gap ignores the hitches of the page's own start-up.
  const tick = (time: number): void => {
    times.push(time);
    if (times.length <= count) { requestAnimationFrame(tick); return; }
    const gaps = times.slice(1).map((t, i) => t - times[i]).sort((x, y) => x - y);
    resolve(gaps[Math.floor(gaps.length / 2)]);
  };
  requestAnimationFrame(tick);
});
// 400 gradient fills in eight slices, one per animation frame, so the benchmark never holds the main thread long enough to miss a switch press.
async function workload(): Promise<number> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return Infinity;
  let total = 0;
  for (let slice = 0; slice < 8; slice++) {
    await frames(1);
    const start = performance.now();
    for (let i = slice * 50; i < slice * 50 + 50; i++) {
      const x = (i * 97) % 1280, y = (i * 53) % 720, gradient = g.createRadialGradient(x, y, 0, x, y, 160);
      gradient.addColorStop(0, 'rgba(255,210,63,.6)'); gradient.addColorStop(1, 'rgba(255,210,63,0)');
      g.globalAlpha = 0.5; g.fillStyle = gradient; g.fillRect(x - 160, y - 160, 320, 320);
    }
    g.getImageData(0, 0, 1, 1);
    total += performance.now() - start;
  }
  return total;
}
// Flags the page so stylesheets can halve ambient animation on low power.
export function applyQuality(quality: Quality): void { document.documentElement.classList.toggle('nc-lowpower', resolveQuality(quality) === 'low'); }
// Runs once at startup (skipped in instant test mode) and settles what Auto means on this computer.
export async function runBenchmark(quality: () => Quality): Promise<void> {
  if (isInstant() || measured) return;
  const frameMs = await frames(24);
  const workMs = await workload();
  measured = pickLevel({ workMs, frameMs });
  lastBenchmark = { workMs, frameMs, level: measured };
  applyQuality(quality());
}
export const particleBudget = (quality: Quality): number => Math.round(qualityLevels[resolveQuality(quality)].particles * (isLowStim() ? 0.25 : 1));
// Particle screens do not need a backing store denser than the screen shows: one canvas pixel per screen pixel, never above 1.5x (a 1080p window renders 1920x1080, not 2560x1440).
export const particleResolution = (): number => Math.min(1.5, Math.max(1, stageScale() * (window.devicePixelRatio || 1)));
export const fxEnabled = (): boolean => !isInstant() || new URLSearchParams(location.search).has('fx');

let app: Application | null = null;
let pending: Promise<Application | null> | null = null;
let generation = 0;
let warned = false;
export const getFx = (): Application | null => app;

// Everything that draws (particles, boost scenes) asks for a render instead of calling app.render(), so one frame costs one render however many of them changed.
let renderScheduled = false;
export function requestRender(): void {
  if (renderScheduled || !app) return;
  renderScheduled = true;
  gsap.ticker.add(() => { renderScheduled = false; app?.render(); }, true);
}

function unavailable(error: unknown): null {
  if (!warned) { warned = true; console.warn('Effects layer unavailable; continuing without it.', error); }
  return null;
}

export function initFx(quality: Quality = 'auto', options: { maxResolution?: number; antialias?: boolean } = {}): Promise<Application | null> {
  if (!fxEnabled()) return Promise.resolve(null);
  if (app) return Promise.resolve(app);
  if (pending) return pending;
  const token = ++generation;
  const level = resolveQuality(quality);
  pending = (async () => {
    let created: Application | null = null;
    try {
      const { Application } = await import('pixi.js');
      const parent = stageElement();
      if (token !== generation || !parent) return null;
      const canvas = document.createElement('canvas');
      canvas.className = 'fx-canvas';
      canvas.dataset.quality = level;
      created = new Application();
      await created.init({ canvas, width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundAlpha: 0, resolution: Math.min(qualityLevels[level].resolution, options.maxResolution ?? Infinity),
        antialias: options.antialias ?? qualityLevels[level].antialias, autoDensity: true, autoStart: false, preference: ['webgl'] });
      if (token !== generation || !parent.isConnected) { created.destroy({ removeView: true }); return null; }
      parent.append(canvas);
      created.render();
      app = created;
      return created;
    } catch (error) {
      try { created?.destroy({ removeView: true }); } catch { /* init failed before a renderer existed */ }
      return unavailable(error);
    } finally { if (token === generation) pending = null; }
  })();
  return pending;
}

export function destroyFx(): void {
  generation++;
  pending = null;
  const current = app;
  app = null;
  try { current?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true }); } catch (error) { unavailable(error); }
}
