import type { MusicId, SfxId } from './manifest';

// Everything here decides what may play and how loud; nothing touches Howler, the DOM or a clock.
export interface AudioSettings { quiet: boolean; effectsVolume: number; musicVolume: number; voiceVolume: number; narration: boolean; lowStim: boolean }
export type ScreenName = 'title' | 'legacy' | 'play' | 'finale';
export type BoostMusic = 'off' | 'live' | 'faded';

export const DUCK_LEVEL = 0.33;
export const DUCK_DOWN_MS = 150;
export const DUCK_UP_MS = 500;
// Music volume steps for the boost track at tier 0..3. Volume only: no pitch or rate change.
export const BOOST_MUSIC_STEPS = [0.5, 0.65, 0.82, 1] as const;
// Low stimulation keeps acknowledgements only: the press click, the correct chime, the try bloop and the switch-check boop.
export const LOW_STIM_SFX: readonly SfxId[] = ['click', 'press', 'correct', 'try', 'boop'];

const level = (percent: number): number => Math.min(1, Math.max(0, percent / 100));

export const musicAllowed = (s: AudioSettings): boolean => !s.quiet && !s.lowStim && s.musicVolume > 0;
export const sfxAllowed = (id: SfxId, s: AudioSettings): boolean => !s.quiet && s.effectsVolume > 0 && (!s.lowStim || LOW_STIM_SFX.includes(id));
// requested: the teacher asked for this line ("Say it"), which low stimulation does not silence; quiet and narration off still do.
export const voiceAllowed = (s: AudioSettings, requested = false): boolean => !s.quiet && s.narration && s.voiceVolume > 0 && (!s.lowStim || requested);

export const duckLevel = (voicePlaying: boolean): number => voicePlaying ? DUCK_LEVEL : 1;
export const boostStep = (tier: number): number => BOOST_MUSIC_STEPS[Math.min(3, Math.max(0, tier))];
export const musicGain = (s: AudioSettings, ducked: boolean, tier: number | null = null): number =>
  musicAllowed(s) ? level(s.musicVolume) * duckLevel(ducked) * (tier === null ? 1 : boostStep(tier)) : 0;
export const sfxGain = (s: AudioSettings, id: SfxId, spriteGain: number): number => sfxAllowed(id, s) ? level(s.effectsVolume) * spriteGain : 0;
export const voiceGain = (s: AudioSettings, requested = false): number => voiceAllowed(s, requested) ? level(s.voiceVolume) : 0;

// What the music should be right now. Boost tracks fade out over the finale ('faded') and the bed returns when the boost ends.
export function wantedMusic(screen: ScreenName | null, boost: BoostMusic): MusicId | null {
  if (boost === 'live') return 'boost';
  if (boost === 'faded') return null;
  return screen === 'title' || screen === 'legacy' ? 'title' : screen === 'play' ? 'mission' : null;
}

const PENTATONIC = [0, 2, 4, 7, 9, 12] as const;
// The correct chime climbs a pentatonic scale with the crew's star total, then starts the climb again.
export const correctRate = (stars: number): number => 2 ** (PENTATONIC[(Math.max(1, stars) - 1) % PENTATONIC.length] / 12);
export const pewRate = (player: number): number => 2 ** ([0, 4, 7, 9][player % 4] / 12);
export const stretchRate = (tier: number): number => 0.9 + 0.15 * tier;

export const PRAISE = ['praise_brilliant', 'praise_great_counting', 'praise_well_done', 'praise_awesome', 'praise_nice_one', 'praise_you_got_it', 'praise_super_star'] as const;
export function nextPraise(last: string | null, random: () => number = Math.random): string {
  const pool = PRAISE.filter(id => id !== last);
  return pool[Math.floor(random() * pool.length)];
}
// "Have another go" only every third try, so it never becomes a nag.
export const shouldRetryLine = (triesSince: number): boolean => triesSince >= 3;

export const questionLine = (question: { kind: 'count' | 'add'; groups: number[] }): string =>
  question.kind === 'count' ? 'how_many' : `add_${question.groups[0]}_${question.groups[1]}`;
export const helpLines = (count: number): string[] => Array.from({ length: Math.min(10, Math.max(0, count)) }, (_, i) => `num_${i + 1}`);
// The lines spoken as a boost round starts. The countdown's "3" cuts whatever is playing, so the theme line is only added when both lines finish before it.
const THEME_LINES: Record<string, string> = { fireworkFrenzy: 'theme_fireworks', warpDrive: 'theme_warp', bubbleBlast: 'theme_bubble' };
export function introLines(theme: string, duration: (id: string) => number, limitMs: number): string[] {
  const theme_ = THEME_LINES[theme];
  return theme_ && duration('boost_round') + duration(theme_) <= limitMs ? ['boost_round', theme_] : ['boost_round'];
}
// When each help number starts, counting from the first: each one begins as the previous clip ends, so no number is cut off.
export function helpSchedule(lines: string[], duration: (id: string) => number, firstMs: number, gapMs = 30): number[] {
  let at = firstMs;
  return lines.map(line => { const start = at; at += duration(line) + gapMs; return start; });
}
export const roundLine = (round: number): string => `round_${round}`;
export const welcomeLine = (destination: number): string => ['welcome_golden_rings', 'welcome_candy_planet', 'welcome_frosty_moon'][destination] ?? '';

// At most `max` sounds overlap; a sound counts for `lifeMs` from when it starts.
export class OverlapLimiter {
  private ends: number[] = [];
  constructor(readonly max: number) {}
  take(now: number, lifeMs: number): boolean {
    this.ends = this.ends.filter(end => end > now);
    if (this.ends.length >= this.max) return false;
    this.ends.push(now + lifeMs);
    return true;
  }
  clear(): void { this.ends = []; }
}

// queue: wait behind whatever is playing. drop: play only if the voice is idle (praise). cut: replace what is playing and forget the queue (countdown and tier cues).
// replace: like queue, but replaces a playing or waiting line with the same tag ("Say it" replays).
export type VoicePolicy = 'queue' | 'drop' | 'cut' | 'replace';
export interface VoiceRequest { id: string; policy: VoicePolicy; tag?: string; requested?: boolean; expiresMs?: number }
export interface VoiceOutput { start(request: VoiceRequest): void; stop(request: VoiceRequest): void }
export type VoiceOutcome = 'played' | 'queued' | 'dropped';
export const MAX_WAITING = 4;

export class VoiceQueue {
  current: VoiceRequest | null = null;
  private waiting: { request: VoiceRequest; at: number }[] = [];
  constructor(private out: VoiceOutput) {}

  get queued(): string[] { return this.waiting.map(item => item.request.id); }

  request(request: VoiceRequest, now: number): VoiceOutcome {
    const { policy, tag } = request;
    if (policy === 'cut') {
      this.waiting = [];
      this.stopCurrent();
      return this.begin(request);
    }
    if (policy === 'drop') return this.current || this.waiting.length ? 'dropped' : this.begin(request);
    if (policy === 'replace' && tag) {
      this.waiting = this.waiting.filter(item => item.request.tag !== tag);
      if (this.current?.tag === tag) { this.stopCurrent(); return this.begin(request); }
    }
    if (!this.current) return this.begin(request);
    // A full queue drops its oldest line: the newest one is the one that still matters.
    if (this.waiting.length >= MAX_WAITING) this.waiting.shift();
    this.waiting.push({ request, at: now });
    return 'queued';
  }

  // The line has finished playing (or been stopped by its owner). A finish from a line that is no longer current is ignored.
  finished(request: VoiceRequest, now: number): void {
    if (this.current !== request) return;
    this.current = null;
    this.advance(now);
  }

  private advance(now: number): void {
    while (this.waiting.length) {
      const next = this.waiting.shift()!;
      if (next.request.expiresMs !== undefined && now - next.at > next.request.expiresMs) continue;
      this.begin(next.request);
      return;
    }
  }

  removeTag(tag: string, now: number): void {
    this.waiting = this.waiting.filter(item => item.request.tag !== tag);
    if (this.current?.tag === tag) { this.stopCurrent(); this.advance(now); }
  }

  // Drop waiting lines with this tag; whatever is playing carries on.
  flushTag(tag: string): void { this.waiting = this.waiting.filter(item => item.request.tag !== tag); }

  // Forget what is waiting but let the line that is playing finish.
  flush(): void { this.waiting = []; }

  clear(): void {
    this.waiting = [];
    this.stopCurrent();
  }

  private stopCurrent(): void {
    const gone = this.current;
    this.current = null;
    if (gone) this.out.stop(gone);
  }

  private begin(request: VoiceRequest): VoiceOutcome {
    this.current = request;
    this.out.start(request);
    return 'played';
  }
}
