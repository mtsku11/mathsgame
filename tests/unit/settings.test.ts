import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from '../../src/settings';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } });
});
afterEach(() => vi.unstubAllGlobals());

const v1 = () => ({
  count: 4, autoAdvance: true, transitionSeconds: 7, enlarged: true, quiet: true, effectsVolume: 25, reduced: true, simple: true,
  players: [['KeyZ', 'KeyX'], ['KeyA', 'KeyL'], ['KeyC', 'KeyM'], ['KeyQ', 'KeyP']].map(keys => ({ preset: 'add10', quantities: true, cooldown: 750, keys })),
});
const stored = (value: unknown, key = 'number-crew-settings-v2') => store.set(key, JSON.stringify(value));

describe('settings v2', () => {
  it('defaults', () => {
    const d = defaultSettings();
    expect(d).toMatchObject({ count: 2, quiet: false, effectsVolume: 75, musicVolume: 50, voiceVolume: 100, narration: true, lowStim: false, quality: 'auto',
      boost: { enabled: true, seconds: 12, difficulty: 'normal', autoStart: true } });
    expect(d.players).toHaveLength(4);
    expect(d.players.every(player => player.boostPower === 1)).toBe(true);
    expect(loadSettings()).toEqual(d);
  });
  it('round-trips under the v2 key, including one and two players', () => {
    for (const count of [1, 2]) {
      const settings = { ...defaultSettings(), count, lowStim: true, boost: { enabled: false, seconds: 20 as const, difficulty: 'hard' as const, autoStart: false } };
      settings.players[0].boostPower = 3;
      expect(saveSettings(settings)).toBe(true);
      expect(store.has('number-crew-settings-v2')).toBe(true);
      expect(loadSettings()).toEqual(settings);
    }
  });
  it('migrates a valid v1 object, keeping its values and adding new defaults', () => {
    stored(v1(), 'number-crew-settings-v1');
    const loaded = loadSettings();
    expect(loaded).toMatchObject({ count: 4, autoAdvance: true, transitionSeconds: 7, enlarged: true, quiet: true, effectsVolume: 25, reduced: true, simple: true });
    expect(loaded.players[0]).toEqual({ preset: 'add10', quantities: true, cooldown: 750, keys: ['KeyZ', 'KeyX'], boostPower: 1 });
    expect(loaded.boost).toEqual(defaultSettings().boost);
    expect([loaded.musicVolume, loaded.narration, loaded.voiceVolume, loaded.lowStim, loaded.quality]).toEqual([50, true, 100, false, 'auto']);
    expect(store.has('number-crew-settings-v2')).toBe(false);
  });
  it('prefers v2 over v1 and never falls back to v1 when v2 is invalid', () => {
    stored(v1(), 'number-crew-settings-v1');
    stored({ ...v1(), count: 1 });
    expect(loadSettings().count).toBe(1);
    stored({ ...v1(), count: 5 });
    expect(loadSettings()).toEqual(defaultSettings());
  });
  it('rejects invalid core values', () => {
    const bad: unknown[] = [null, 'x', [], { ...v1(), count: 0 }, { ...v1(), count: 5 }, { ...v1(), count: 2.5 }, { ...v1(), count: '2' },
      { ...v1(), players: v1().players.slice(0, 3) }, { ...v1(), quiet: 'no' }, { ...v1(), players: v1().players.map(p => ({ ...p, keys: ['KeyA', 'KeyB'] })) },
      { ...v1(), players: v1().players.map(p => ({ ...p, cooldown: 2000 })) }, { ...v1(), players: v1().players.map(p => ({ ...p, preset: 'sub' })) }];
    for (const value of bad) { stored(value); expect(loadSettings()).toEqual(defaultSettings()); }
    store.set('number-crew-settings-v2', '{not json');
    expect(loadSettings()).toEqual(defaultSettings());
  });
  it('replaces each invalid new field with its default without discarding the rest', () => {
    const d = defaultSettings();
    stored({ ...v1(), count: 3, boost: { enabled: 'yes', seconds: 10, difficulty: 'extreme', autoStart: 1 }, musicVolume: 30, voiceVolume: '100', narration: 'on', lowStim: 1, quality: 'ultra',
      players: v1().players.map((p, i) => ({ ...p, boostPower: i === 0 ? 4 : i === 1 ? 2 : 'x' })) });
    const loaded = loadSettings();
    expect(loaded.count).toBe(3);
    expect(loaded.players[0].keys).toEqual(['KeyZ', 'KeyX']);
    expect(loaded.boost).toEqual(d.boost);
    expect([loaded.musicVolume, loaded.voiceVolume, loaded.narration, loaded.lowStim, loaded.quality]).toEqual([d.musicVolume, d.voiceVolume, d.narration, d.lowStim, d.quality]);
    expect(loaded.players.map(p => p.boostPower)).toEqual([1, 2, 1, 1]);
    stored({ ...v1(), boost: null });
    expect(loadSettings().boost).toEqual(d.boost);
  });
  it('accepts every allowed new value', () => {
    stored({ ...v1(), boost: { enabled: false, seconds: 8, difficulty: 'easy', autoStart: false }, musicVolume: 0, voiceVolume: 25, effectsVolume: 100, narration: false, lowStim: true, quality: 'low' });
    expect(loadSettings()).toMatchObject({ boost: { enabled: false, seconds: 8, difficulty: 'easy', autoStart: false }, musicVolume: 0, voiceVolume: 25, effectsVolume: 100, narration: false, lowStim: true, quality: 'low' });
  });
});
