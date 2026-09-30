import type raw from '../../public/audio/manifest.json';

// Sprite entries are [offsetMs, durationMs, defaultVolume?]. The third value is a gain, not Howler's loop flag, so it never reaches Howler.
export type Sprite = readonly [number, number, number?];
export interface MusicEntry { loop: boolean; loopFrom?: number; loopTo?: number; duration: number; src: string[] }
export type MusicId = keyof typeof raw.music;
export type SfxId = keyof typeof raw.sfx.sprite;
export type VoiceId = keyof typeof raw.voice.sprite;
export interface SpriteSheet<Id extends string> { src: string[]; sprite: Record<Id, Sprite> }

// public/audio/manifest.json is fetched at the first teacher click (Vite cannot import from public/), and is precached with the audio it describes. Empty until then, so
// nothing can be looked up, and therefore nothing can play, before the manifest has loaded.
export let music = {} as Record<MusicId, MusicEntry>;
export let sfx = { src: [], sprite: {} } as unknown as SpriteSheet<SfxId>;
export let voice = { src: [], sprite: {}, text: {} } as unknown as SpriteSheet<VoiceId> & { text: Record<VoiceId, string> };

export function useManifest(data: typeof raw): void {
  music = data.music as Record<MusicId, MusicEntry>;
  sfx = { src: data.sfx.src, sprite: data.sfx.sprite as unknown as Record<SfxId, Sprite> };
  voice = { src: data.voice.src, sprite: data.voice.sprite as unknown as Record<VoiceId, Sprite>, text: data.voice.text as Record<VoiceId, string> };
}
// Resolved against the page, so the game works from any base path.
export const audioUrl = (path: string): string => new URL(path, document.baseURI).href;
export async function loadManifest(): Promise<void> {
  try {
    useManifest(await (await fetch(audioUrl('audio/manifest.json'))).json());
  } catch (error) {
    console.warn('Audio manifest failed to load; the game stays silent.', error);
  }
}

export const hasVoice = (id: string): id is VoiceId => id in voice.sprite;
export const spriteVolume = (sprite: Sprite): number => sprite[2] ?? 1;
