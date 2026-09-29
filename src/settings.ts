import type { Preset } from './game/questions';

export interface PlayerSettings { preset: Preset; quantities: boolean; cooldown: number; keys: [string, string] }
export interface Settings { count: number; autoAdvance: boolean; transitionSeconds: number; enlarged: boolean; quiet: boolean; effectsVolume: number; reduced: boolean; simple: boolean; players: PlayerSettings[] }
export const defaultSettings = (): Settings => ({ count: 3, autoAdvance: false, transitionSeconds: 4, enlarged: false, quiet: true, effectsVolume: 100,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches, simple: false,
  players: [['KeyF', 'KeyJ'], ['KeyA', 'KeyL'], ['KeyC', 'KeyM'], ['KeyQ', 'KeyP']].map(keys => ({ preset: 'count', quantities: false, cooldown: 500, keys: keys as [string, string] })) });
export function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    const saved = JSON.parse(localStorage.getItem('number-crew-settings-v1') ?? 'null');
    if (!saved || ![3, 4].includes(saved.count) || !Array.isArray(saved.players) || saved.players.length !== 4) return defaults;
    const used = new Set<string>();
    for (const player of saved.players) {
      if (!['count', 'add5', 'add10'].includes(player.preset) || typeof player.quantities !== 'boolean' ||
        !Number.isFinite(player.cooldown) || player.cooldown < 0 || player.cooldown > 1500 || !Array.isArray(player.keys) || player.keys.length !== 2) return defaults;
      for (const key of player.keys) { if (typeof key !== 'string' || !/^Key[A-Z]$/.test(key) || used.has(key)) return defaults; used.add(key); }
    }
    if (['enlarged', 'quiet', 'reduced', 'simple'].some(key => typeof saved[key] !== 'boolean')) return defaults;
    saved.effectsVolume = [0, 25, 50, 75, 100].includes(saved.effectsVolume) ? saved.effectsVolume : defaults.effectsVolume;
    saved.autoAdvance = typeof saved.autoAdvance === 'boolean' ? saved.autoAdvance : false;
    saved.transitionSeconds = Number.isInteger(saved.transitionSeconds) && saved.transitionSeconds >= 2 && saved.transitionSeconds <= 10 ? saved.transitionSeconds : 4;
    return saved as Settings;
  } catch { return defaults; }
}
export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem('number-crew-settings-v1', JSON.stringify(settings)); return true; } catch { return false; }
}
