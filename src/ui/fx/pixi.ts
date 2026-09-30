import type { Application } from 'pixi.js';
import type { Quality } from '../../settings';
import { isInstant, isLowStim } from './motion';
import { STAGE_HEIGHT, STAGE_WIDTH, stageElement } from '../stage';

export type QualityLevel = Exclude<Quality, 'auto'>;
export const qualityLevels: Record<QualityLevel, { resolution: number; antialias: boolean; particles: number }> = {
  high: { resolution: 2, antialias: true, particles: 2500 },
  medium: { resolution: 1.5, antialias: true, particles: 1200 },
  low: { resolution: 1, antialias: false, particles: 600 },
};
export const resolveQuality = (quality: Quality): QualityLevel => quality === 'auto' ? 'high' : quality;
export const particleBudget = (quality: Quality): number => Math.round(qualityLevels[resolveQuality(quality)].particles * (isLowStim() ? 0.25 : 1));
export const fxEnabled = (): boolean => !isInstant() || new URLSearchParams(location.search).has('fx');

let app: Application | null = null;
let pending: Promise<Application | null> | null = null;
let generation = 0;
let warned = false;
export const getFx = (): Application | null => app;

function unavailable(error: unknown): null {
  if (!warned) { warned = true; console.warn('Effects layer unavailable; continuing without it.', error); }
  return null;
}

export function initFx(quality: Quality = 'auto'): Promise<Application | null> {
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
      await created.init({ canvas, width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundAlpha: 0, resolution: qualityLevels[level].resolution,
        antialias: qualityLevels[level].antialias, autoDensity: true, autoStart: false, preference: ['webgl'] });
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
