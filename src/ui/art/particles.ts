import { starPath } from './stars';
import type { ParticleShape } from '../fx/particleSim';

// White shapes on a 128x128 logical atlas; Pixi tints them per particle. Frames are in logical pixels.
export const ATLAS_SIZE = 128;
export const atlasFrames: Record<ParticleShape, { x: number; y: number; w: number; h: number }> = {
  star: { x: 0, y: 0, w: 64, h: 64 },
  sparkle: { x: 64, y: 0, w: 64, h: 64 },
  dot: { x: 0, y: 64, w: 48, h: 48 },
  strip: { x: 64, y: 64, w: 24, h: 48 },
  sweet: { x: 88, y: 64, w: 40, h: 48 },
};

export function atlasSvg(): string {
  const { star, sparkle, dot, strip, sweet } = atlasFrames;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ATLAS_SIZE} ${ATLAS_SIZE}" width="${ATLAS_SIZE}" height="${ATLAS_SIZE}">
<defs><radialGradient id="d" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<path d="${starPath(star.x + 32, star.y + 34, 27, 11.5)}" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
<path d="${starPath(sparkle.x + 32, sparkle.y + 32, 30, 5, 4)}" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
<circle cx="${dot.x + 24}" cy="${dot.y + 24}" r="23" fill="url(#d)"/>
<rect x="${strip.x + 3}" y="${strip.y + 3}" width="18" height="42" rx="5" fill="#fff"/>
<g fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"><ellipse cx="${sweet.x + 20}" cy="${sweet.y + 24}" rx="12" ry="10"/><path d="M${sweet.x + 8} ${sweet.y + 24} L${sweet.x + 2} ${sweet.y + 14} L${sweet.x + 2} ${sweet.y + 34}Z"/><path d="M${sweet.x + 32} ${sweet.y + 24} L${sweet.x + 38} ${sweet.y + 14} L${sweet.x + 38} ${sweet.y + 34}Z"/></g>
</svg>`;
}
