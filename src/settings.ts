import type { Preset } from './game/questions';
import { capIds, type CapColour } from './ui/art/caps';

export type BoostPower = 1 | 2 | 3;
export type BoostDifficulty = 'easy' | 'normal' | 'hard';
export type Quality = 'auto' | 'high' | 'medium' | 'low';
export interface PlayerSettings { preset: Preset; quantities: boolean; cooldown: number; keys: [string, string]; boostPower: BoostPower; caps: [CapColour, CapColour] }
export interface BoostSettings { enabled: boolean; seconds: 8 | 12 | 16 | 20; difficulty: BoostDifficulty; autoStart: boolean }
export interface Settings {
  count: number; autoAdvance: boolean; transitionSeconds: number; enlarged: boolean; quiet: boolean; effectsVolume: number; reduced: boolean; simple: boolean;
  boost: BoostSettings; musicVolume: number; narration: boolean; voiceVolume: number; lowStim: boolean; quality: Quality; players: PlayerSettings[];
}
const KEY = 'number-crew-settings-v2';
const LEGACY_KEY = 'number-crew-settings-v1';
const VOLUMES = [0, 25, 50, 75, 100];
const CAP_CHOICES: readonly CapColour[] = ['pilot', ...capIds];
export const defaultSettings = (): Settings => ({ count: 2, autoAdvance: false, transitionSeconds: 4, enlarged: false, quiet: false, effectsVolume: 75,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches, simple: false,
  boost: { enabled: true, seconds: 12, difficulty: 'normal', autoStart: true }, musicVolume: 50, narration: true, voiceVolume: 100, lowStim: false, quality: 'auto',
  players: [['KeyF', 'KeyJ'], ['KeyA', 'KeyL'], ['KeyC', 'KeyM'], ['KeyQ', 'KeyP']].map(keys => ({ preset: 'count', quantities: false, cooldown: 500, keys: keys as [string, string], boostPower: 1 as BoostPower, caps: ['pilot', 'pilot'] as [CapColour, CapColour] })) });
const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
const flag = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
function sanitize(saved: any, defaults: Settings): Settings {
  if (!saved || typeof saved !== 'object' || !Number.isInteger(saved.count) || saved.count < 1 || saved.count > 4 || !Array.isArray(saved.players) || saved.players.length !== 4) return defaults;
  const used = new Set<string>();
  for (const player of saved.players) {
    if (!player || !['count', 'add5', 'add10'].includes(player.preset) || typeof player.quantities !== 'boolean' ||
      !Number.isFinite(player.cooldown) || player.cooldown < 0 || player.cooldown > 1500 || !Array.isArray(player.keys) || player.keys.length !== 2) return defaults;
    for (const key of player.keys) { if (typeof key !== 'string' || !/^Key[A-Z]$/.test(key) || used.has(key)) return defaults; used.add(key); }
  }
  if (['enlarged', 'quiet', 'reduced', 'simple'].some(key => typeof saved[key] !== 'boolean')) return defaults;
  const boost = saved.boost && typeof saved.boost === 'object' ? saved.boost : {};
  return {
    count: saved.count, enlarged: saved.enlarged, quiet: saved.quiet, reduced: saved.reduced, simple: saved.simple,
    autoAdvance: flag(saved.autoAdvance, false),
    transitionSeconds: Number.isInteger(saved.transitionSeconds) && saved.transitionSeconds >= 2 && saved.transitionSeconds <= 10 ? saved.transitionSeconds : 4,
    effectsVolume: pick(saved.effectsVolume, VOLUMES, defaults.effectsVolume),
    boost: {
      enabled: flag(boost.enabled, defaults.boost.enabled), seconds: pick(boost.seconds, [8, 12, 16, 20] as const, defaults.boost.seconds),
      difficulty: pick(boost.difficulty, ['easy', 'normal', 'hard'] as const, defaults.boost.difficulty), autoStart: flag(boost.autoStart, defaults.boost.autoStart),
    },
    musicVolume: pick(saved.musicVolume, VOLUMES, defaults.musicVolume), narration: flag(saved.narration, defaults.narration),
    voiceVolume: pick(saved.voiceVolume, VOLUMES, defaults.voiceVolume), lowStim: flag(saved.lowStim, defaults.lowStim),
    quality: pick(saved.quality, ['auto', 'high', 'medium', 'low'] as const, defaults.quality),
    players: saved.players.map((player: any): PlayerSettings => ({
      preset: player.preset, quantities: player.quantities, cooldown: player.cooldown, keys: [player.keys[0], player.keys[1]],
      boostPower: pick(player.boostPower, [1, 2, 3] as const, 1),
      caps: [pick(player.caps?.[0], CAP_CHOICES, 'pilot'), pick(player.caps?.[1], CAP_CHOICES, 'pilot')],
    })),
  };
}
export function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? 'null'), defaults);
  } catch { return defaults; }
}
export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
