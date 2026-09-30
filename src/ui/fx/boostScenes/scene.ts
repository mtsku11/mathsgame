import type { Application } from 'pixi.js';
import type { BoostTheme, BoostTier } from '../../../app/events';
import { pilotColors } from '../../art/pilot';
import { createBubbleBlastScene } from './bubbleBlast';
import { createFireworkFrenzyScene } from './fireworkFrenzy';
import { createWarpDriveScene } from './warpDrive';

export interface Point { x: number; y: number }
export interface Destination { name: string; kind: 'ring' | 'candy' | 'ice' }
export interface SceneContext {
  // DOM layer under the effects canvas, and one above it for big cards. A scene owns everything it puts in either and removes it in unmount().
  world: HTMLElement;
  top: HTMLElement;
  fx: Application | null;
  players: number;
  colours: number[];
  saucers: HTMLElement[];
  round: number;
  stars: number;
  // The planet a Warp Drive round reaches, or null after the last round, when the crew warps home to the finale.
  destination: Destination | null;
  shake(pixels: number, seconds: number): void;
}
// Everything a boost theme has to provide. The view owns the saucers, bolts, meter, cards and timing; a scene is only the thing being powered.
// Its animations play inside the finale time the game state allows and never decide the tier, the result or when the boost ends.
export interface BoostScene {
  // Where bolts land, in 1280x720 stage coordinates.
  readonly target: Point;
  // The scene reacts at the moment of the press (a rocket leaves the saucer) instead of waiting for a bolt to land, so the view draws no bolts or beams for it.
  readonly direct?: boolean;
  mount(context: SceneContext): void;
  // A bolt has arrived. `progress` is the meter fill, 0..1.
  onPress(player: number, progress: number): void;
  onTier(tier: BoostTier): void;
  // The payoff at the tier reached. Resolves when it has finished; the game does not wait for it.
  playFinale(tier: BoostTier): Promise<void>;
  setPaused(paused: boolean): void;
  unmount(): void;
}

export const colourOf = (player: number): number => parseInt(pilotColors[player].color.slice(1), 16);

export function createScene(theme: BoostTheme): BoostScene {
  return theme === 'warpDrive' ? createWarpDriveScene() : theme === 'fireworkFrenzy' ? createFireworkFrenzyScene() : createBubbleBlastScene();
}
