import type { MusicId, SfxId, VoiceId } from './manifest';
import { music, sfx, voice } from './manifest';

// The audio layer decides what plays; a backend only makes sound. The Howler backend is the real one; the silent one keeps the same timing with no output, for tests and for
// browsers without Web Audio.
export interface Handle {
  pause(): void;
  resume(): void;
  stop(fadeMs?: number): void;
  volume(value: number, fadeMs?: number): void;
}
export interface PlayOptions { volume: number; rate?: number; maxMs?: number; onEnd?: () => void }
export interface Loaded { sfx: boolean; voice: boolean; music: MusicId[] }
export interface Backend {
  readonly kind: 'howler' | 'silent';
  // Loads the sprites and starts decoding the music. Never rejects: a file that fails to load only means its sounds are silent.
  load(): Promise<void>;
  // Called from a user gesture. Returns true once the audio context is running.
  unlock(): boolean;
  loaded(): Loaded;
  sfx(id: SfxId, options: PlayOptions): Handle;
  voice(id: VoiceId, options: PlayOptions): Handle;
  music(id: MusicId, options: PlayOptions): Handle;
}

// A countdown that can be paused, so a paused game never sees a line "finish" early.
export class Timed {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startedAt = 0;
  private done = false;
  constructor(private left: number, private onDone: () => void) {}
  start(): void {
    this.startedAt = performance.now();
    this.timer = setTimeout(() => this.finish(), Math.max(0, this.left));
  }
  pause(): void {
    if (this.done || this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.left -= performance.now() - this.startedAt;
  }
  resume(): void { if (!this.done && this.timer === undefined) this.start(); }
  cancel(): void {
    this.done = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.timer = undefined;
    this.onDone();
  }
}

export const spriteMs = (sprite: readonly [number, number, number?], options: PlayOptions): number => Math.min(sprite[1] / (options.rate ?? 1), options.maxMs ?? Infinity);

function timedHandle(ms: number, onEnd: (() => void) | undefined, loops = false): Handle {
  const timed = loops ? null : new Timed(ms, () => onEnd?.());
  timed?.start();
  return {
    pause: () => timed?.pause(),
    resume: () => timed?.resume(),
    stop: () => timed?.cancel(),
    volume: () => {},
  };
}

export function createSilentBackend(): Backend {
  return {
    kind: 'silent',
    load: () => Promise.resolve(),
    unlock: () => true,
    loaded: () => ({ sfx: true, voice: true, music: Object.keys(music) as MusicId[] }),
    sfx: (id, options) => timedHandle(spriteMs(sfx.sprite[id], options), options.onEnd),
    voice: (id, options) => timedHandle(spriteMs(voice.sprite[id], options), options.onEnd),
    music: (id, options) => timedHandle(music[id].duration * 1000, options.onEnd, music[id].loop),
  };
}
