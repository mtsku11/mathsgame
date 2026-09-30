import { Howl, Howler } from 'howler';
import { spriteMs, Timed, type Backend, type Handle, type Loaded, type PlayOptions } from './backend';
import { audioUrl, music, sfx, voice, type MusicId, type Sprite } from './manifest';

// Web Audio only (html5 streaming needs range requests, which the offline cache does not serve). Effects and voice are Howler sprites; the manifest's third sprite value is a gain,
// so only offset and duration are passed on. Music is played straight on Howler's context: Howler sprites cannot loop an inner region after an intro, an
// AudioBufferSourceNode can (loopStart/loopEnd), and it loops without a gap.
const spriteMap = (sprites: Record<string, Sprite>): Record<string, [number, number]> =>
  Object.fromEntries(Object.entries(sprites).map(([id, sprite]) => [id, [sprite[0], sprite[1]] as [number, number]]));

function loadSprite(source: { src: string[]; sprite: Record<string, Sprite> }): Promise<Howl> {
  return new Promise(resolve => {
    const howl = new Howl({ src: source.src.map(audioUrl), sprite: spriteMap(source.sprite), html5: false, preload: true });
    howl.once('load', () => resolve(howl));
    howl.once('loaderror', () => { console.warn('Audio file failed to load; its sounds stay silent.', source.src); resolve(howl); });
  });
}

const NO_HANDLE: Handle = { pause() {}, resume() {}, stop() {}, volume() {} };
const RAMP = 0.03;

class MusicVoice implements Handle {
  private gain: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private position = 0;
  private startedAt = 0;
  private playing = false;
  private stopped = false;
  private target: number;
  private timed: Timed | null = null;

  constructor(private ctx: AudioContext, destination: AudioNode, private entry: (typeof music)[MusicId], buffer: Promise<AudioBuffer | null>, volume: number, private onEnd?: () => void) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
    this.target = volume;
    void buffer.then(decoded => { if (decoded && !this.stopped) this.begin(decoded, 0, 0.25); });
  }

  private buffer: AudioBuffer | null = null;

  private begin(decoded: AudioBuffer, offset: number, fadeIn: number): void {
    this.buffer = decoded;
    const { entry, ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    if (entry.loop && entry.loopFrom !== undefined && entry.loopTo !== undefined) {
      source.loop = true;
      source.loopStart = entry.loopFrom;
      source.loopEnd = entry.loopTo;
    }
    source.connect(this.gain);
    source.start(0, offset);
    this.source = source;
    this.position = offset;
    this.startedAt = ctx.currentTime;
    this.playing = true;
    this.ramp(this.target, fadeIn);
    if (!entry.loop) {
      this.timed?.cancel();
      this.timed = new Timed((decoded.duration - offset) * 1000, () => { this.playing = false; this.onEnd?.(); });
      this.timed.start();
    }
  }

  private ramp(value: number, seconds: number): void {
    const param = this.gain.gain, now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + Math.max(seconds, 0.005));
  }

  private where(): number {
    const { entry } = this;
    const at = this.position + (this.ctx.currentTime - this.startedAt);
    if (entry.loop && entry.loopFrom !== undefined && entry.loopTo !== undefined && at >= entry.loopTo) return entry.loopFrom + (at - entry.loopFrom) % (entry.loopTo - entry.loopFrom);
    return at;
  }

  private release(after: number): void {
    const source = this.source;
    this.source = null;
    this.playing = false;
    if (!source) return;
    source.stop(this.ctx.currentTime + after);
    source.onended = () => source.disconnect();
  }

  pause(): void {
    if (!this.playing || this.stopped) return;
    this.position = this.where();
    this.ramp(0, RAMP);
    this.release(RAMP);
    this.timed?.pause();
  }

  resume(): void {
    if (this.playing || this.stopped || !this.buffer) return;
    this.begin(this.buffer, this.position, RAMP);
  }

  stop(fadeMs = 0): void {
    if (this.stopped) return;
    this.stopped = true;
    this.timed?.cancel();
    const seconds = Math.max(fadeMs / 1000, RAMP);
    this.ramp(0, seconds);
    this.release(seconds);
    setTimeout(() => this.gain.disconnect(), seconds * 1000 + 100);
  }

  volume(value: number, fadeMs = 0): void {
    this.target = value;
    if (this.stopped) return;
    this.ramp(value, fadeMs / 1000);
  }
}

class SpriteVoice implements Handle {
  private timed: Timed;
  private ended = false;
  constructor(private howl: Howl, private soundId: number, private volumeNow: number, ms: number, truncated: boolean, onEnd?: () => void) {
    this.timed = new Timed(ms, () => {
      this.ended = true;
      if (truncated) this.stop(40);
      onEnd?.();
    });
    this.timed.start();
  }
  pause(): void { if (this.ended) return; this.howl.pause(this.soundId); this.timed.pause(); }
  resume(): void { if (this.ended) return; this.howl.play(this.soundId); this.timed.resume(); }
  stop(fadeMs = 0): void {
    this.timed.cancel();
    if (fadeMs > 0) { this.howl.fade(this.volumeNow, 0, fadeMs, this.soundId); setTimeout(() => this.howl.stop(this.soundId), fadeMs + 20); } else this.howl.stop(this.soundId);
  }
  volume(value: number, fadeMs = 0): void {
    if (fadeMs > 0) this.howl.fade(this.volumeNow, value, fadeMs, this.soundId); else this.howl.volume(value, this.soundId);
    this.volumeNow = value;
  }
}

export function createHowlerBackend(): Backend {
  Howler.autoSuspend = false;
  let sfxHowl: Howl | null = null;
  let voiceHowl: Howl | null = null;
  const buffers = new Map<MusicId, Promise<AudioBuffer | null>>();
  const decoded = new Set<MusicId>();

  const context = (): AudioContext | null => Howler.usingWebAudio && Howler.ctx ? Howler.ctx : null;
  function decode(id: MusicId): Promise<AudioBuffer | null> {
    let buffer = buffers.get(id);
    if (!buffer) {
      const ctx = context();
      buffer = ctx ? fetch(audioUrl(music[id].src[0])).then(response => response.arrayBuffer()).then(data => ctx.decodeAudioData(data)).then(result => { decoded.add(id); return result; }).catch(error => {
        console.warn('Music failed to load; it stays silent.', id, error);
        return null;
      }) : Promise.resolve(null);
      buffers.set(id, buffer);
    }
    return buffer;
  }
  function play(howl: Howl | null, id: string, sprite: Sprite, options: PlayOptions): Handle {
    if (!howl) return NO_HANDLE;
    const soundId = howl.play(id);
    howl.volume(options.volume, soundId);
    if (options.rate) howl.rate(options.rate, soundId);
    const ms = spriteMs(sprite, options);
    return new SpriteVoice(howl, soundId, options.volume, ms, ms < sprite[1] / (options.rate ?? 1), options.onEnd);
  }

  return {
    kind: 'howler',
    async load() {
      [sfxHowl, voiceHowl] = await Promise.all([loadSprite(sfx), loadSprite(voice)]);
      (Object.keys(music) as MusicId[]).forEach(id => { void decode(id); });
    },
    unlock() {
      const ctx = context();
      if (!ctx) return false;
      void ctx.resume();
      return ctx.state === 'running';
    },
    loaded(): Loaded {
      return { sfx: sfxHowl?.state() === 'loaded', voice: voiceHowl?.state() === 'loaded', music: [...decoded] };
    },
    sfx: (id, options) => play(sfxHowl, id, sfx.sprite[id], options),
    voice: (id, options) => play(voiceHowl, id, voice.sprite[id], options),
    music(id, options) {
      const ctx = context();
      if (!ctx) return NO_HANDLE;
      return new MusicVoice(ctx, Howler.masterGain ?? ctx.destination, music[id], decode(id), options.volume, options.onEnd);
    },
  };
}
