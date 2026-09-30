import { events } from '../app/events';
import { COUNTDOWN_FROM_MS } from '../game/boost';
import { isCalm } from '../ui/fx/motion';
import { createSilentBackend, type Backend, type Handle } from './backend';
import { createHowlerBackend } from './howler';
import { hasVoice, loadManifest, sfx, spriteVolume, voice, type MusicId, type SfxId } from './manifest';
import {
  DUCK_DOWN_MS, DUCK_UP_MS, OverlapLimiter, VoiceQueue, correctRate, helpLines, helpSchedule, introLines, musicAllowed, musicGain, nextPraise, pewRate, questionLine, roundLine, sfxGain, shouldRetryLine,
  stretchRate, voiceAllowed, voiceGain, welcomeLine, wantedMusic,
  type AudioSettings, type BoostMusic, type ScreenName, type VoicePolicy, type VoiceRequest,
} from './rules';

export interface AudioEntry { channel: 'music' | 'sfx' | 'voice'; action: 'play' | 'stop' | 'pause' | 'resume' | 'volume'; id: string; time: number; volume: number; rate?: number }
export interface AudioHook {
  log: AudioEntry[];
  clear(): void;
  state(): {
    backend: string; unlocked: boolean; ready: boolean; paused: boolean; screen: ScreenName | null; music: { id: MusicId | null; volume: number }; jingle: string | null;
    voice: { current: string | null; queued: string[] }; ducked: boolean; boost: { music: BoostMusic; tier: number }; loaded: { sfx: boolean; voice: boolean; music: string[] };
  };
}
declare global { interface Window { __NC_AUDIO__?: AudioHook } }

export interface AudioLayer {
  // Settings changed (volumes, quiet, narration, low stimulation): re-apply them to what is playing.
  refresh(): void;
  // Let the teacher hear a volume change: `voice` says a short line, `effects` plays the correct chime.
  preview(channel: 'voice' | 'effects'): void;
  // The help count would be spoken right now (audio unlocked and loaded, narration audible).
  narrating(): boolean;
}

const LOG_LIMIT = 600;
const PEW_MS = 400;
const BOOST_FADE_MS = 1500;
const BED_FADE_MS = 600;
const PRAISE_DELAY_MS = 120;
const COUNT_FIRST_MS = 350;
const PRESS_FAST_WAIT_MS = 2500;

const silentRequested = (): boolean => window.__NC_TEST__ === true || /[?&](instant|silentaudio)\b/.test(location.search);

export function createAudio(settings: AudioSettings, backend: Backend = silentRequested() ? createSilentBackend() : createHowlerBackend()): AudioLayer {
  const log: AudioEntry[] = [];
  const record = (channel: AudioEntry['channel'], action: AudioEntry['action'], id: string, volume = 0, rate?: number): void => {
    log.push({ channel, action, id, time: performance.now(), volume, ...rate === undefined ? {} : { rate } });
    if (log.length > LOG_LIMIT) log.shift();
  };

  let unlocked = false;
  let ready = false;
  let paused = false;
  let screen: ScreenName | null = null;
  let boostMusic: BoostMusic = 'off';
  let boostTier = 0;
  let boost: { round: number; theme: string; finale: boolean } | null = null;
  let stars = 0;
  let triesSince = 0;
  let lastPraise: string | null = null;
  let ducked = false;
  const pewParity = [false, false, false, false];
  const pews = new OverlapLimiter(8);
  const fireworks = new OverlapLimiter(6);
  const sparks = new OverlapLimiter(4);

  interface Playing { id: MusicId; handle: Handle }
  let bed: Playing | null = null;
  const parked = new Map<MusicId, Handle>();
  let parkTimer: ReturnType<typeof setTimeout> | undefined;
  let jingle: { id: MusicId; handle: Handle; bedDuck: boolean } | null = null;
  const live = new Set<Handle>();
  const voiceHandles = new Map<VoiceRequest, Handle>();
  const timers = new Map<ReturnType<typeof setTimeout>, string>();

  const active = (): boolean => unlocked && ready;
  const later = (ms: number, tag: string, action: () => void): void => {
    const timer = setTimeout(() => { timers.delete(timer); action(); }, ms);
    timers.set(timer, tag);
  };
  // A help count in progress: every number not yet announced is announced at once when it is interrupted, so the on-screen numbers never wait on the voice.
  let helpRun: { player: number; lines: string[]; next: number } | null = null;
  function flushHelp(): void {
    const run = helpRun;
    helpRun = null;
    if (run) for (let n = run.next + 1; n <= run.lines.length; n++) events.emit('helpCount', { player: run.player, n });
  }
  const cancelTimers = (tag?: string): void => {
    if (!tag || tag === 'help') flushHelp();
    for (const [timer, owner] of timers) if (!tag || owner === tag) { clearTimeout(timer); timers.delete(timer); }
  };

  // ---- Music -------------------------------------------------------------------------------------------------------------------------------------------------

  const bedTarget = (id: MusicId): number => musicGain(settings, ducked || (jingle?.bedDuck ?? false), id === 'boost' ? boostTier : null);
  const jingleTarget = (): number => musicGain(settings, ducked);
  function applyMusicVolume(ms = ducked ? DUCK_DOWN_MS : DUCK_UP_MS): void {
    if (bed) { const volume = bedTarget(bed.id); bed.handle.volume(volume, ms); record('music', 'volume', bed.id, volume); }
    if (jingle) jingle.handle.volume(jingleTarget(), ms);
  }
  function setDucked(next: boolean): void {
    if (ducked === next) return;
    ducked = next;
    applyMusicVolume();
  }
  const updateDuck = (): void => setDucked(queue.current !== null);

  function leave(current: Playing): void {
    if (current.id === 'mission') {
      // The mission bed keeps its place while a boost round plays, then carries on.
      current.handle.volume(0, BED_FADE_MS);
      parked.set(current.id, current.handle);
      record('music', 'pause', current.id);
      clearTimeout(parkTimer);
      parkTimer = setTimeout(() => { if (parked.get('mission') === current.handle) current.handle.pause(); }, BED_FADE_MS + 30);
    } else {
      // Only a finished boost fades slowly; a skipped one stops quickly.
      current.handle.stop(current.id === 'boost' && boostMusic === 'faded' ? BOOST_FADE_MS : BED_FADE_MS);
      record('music', 'stop', current.id);
    }
  }
  function enter(id: MusicId): void {
    const volume = bedTarget(id);
    const kept = parked.get(id);
    if (kept) {
      parked.delete(id);
      clearTimeout(parkTimer);
      kept.resume();
      kept.volume(volume, 500);
      bed = { id, handle: kept };
      record('music', 'resume', id, volume);
      return;
    }
    const handle = backend.music(id, {
      volume,
      // The boost take is one 30 s file. Its longest live phase ends by 25 s and the finale fades it, but if it ever runs out mid-boost it starts again rather than going silent.
      onEnd: () => { if (bed?.handle === handle && id === 'boost' && boostMusic === 'live') { bed = null; reconcile(); } },
    });
    bed = { id, handle };
    record('music', 'play', id, volume);
  }
  function reconcile(): void {
    if (!active()) return;
    if (paused) { applyMusicVolume(); return; }
    const want = musicAllowed(settings) ? wantedMusic(screen, boostMusic) : null;
    if (want === (bed?.id ?? null)) { applyMusicVolume(); return; }
    if (bed) { leave(bed); bed = null; }
    if (!want) {
      // Quiet or low stimulation: nothing may stay parked either.
      if (!musicAllowed(settings)) for (const [id, handle] of parked) { handle.stop(200); parked.delete(id); }
      return;
    }
    enter(want);
  }
  function playJingle(id: MusicId, bedDuck: boolean): void {
    if (!active() || !musicAllowed(settings)) return;
    jingle?.handle.stop(200);
    const volume = musicGain(settings, ducked);
    const handle = backend.music(id, { volume, onEnd: () => { if (jingle?.handle === handle) { jingle = null; applyMusicVolume(); } } });
    jingle = { id, handle, bedDuck };
    record('music', 'play', id, volume);
    applyMusicVolume();
  }

  // ---- Effects -----------------------------------------------------------------------------------------------------------------------------------------------

  function playSfx(id: SfxId, options: { rate?: number; maxMs?: number } = {}): void {
    if (!active()) return;
    const volume = sfxGain(settings, id, spriteVolume(sfx.sprite[id]));
    if (volume <= 0) return;
    const handle: Handle = backend.sfx(id, { volume, ...options, onEnd: () => live.delete(handle) });
    live.add(handle);
    record('sfx', 'play', id, volume, options.rate);
  }

  // ---- Voice -------------------------------------------------------------------------------------------------------------------------------------------------

  const queue: VoiceQueue = new VoiceQueue({
    start(request) {
      const volume = voiceGain(settings, request.requested);
      const handle: Handle = backend.voice(request.id as never, { volume, onEnd: () => { voiceHandles.delete(request); queue.finished(request, performance.now()); updateDuck(); } });
      voiceHandles.set(request, handle);
      record('voice', 'play', request.id, volume);
      if (paused) handle.pause();
    },
    stop(request) {
      voiceHandles.get(request)?.stop(40);
      voiceHandles.delete(request);
      record('voice', 'stop', request.id);
    },
  });
  function say(id: string, policy: VoicePolicy, extra: { tag?: string; requested?: boolean; expiresMs?: number } = {}): void {
    if (!active() || !hasVoice(id) || !voiceAllowed(settings, extra.requested)) return;
    queue.request({ id, policy, ...extra }, performance.now());
    updateDuck();
  }
  const cue = (id: string): void => say(id, 'cut', { tag: 'boost' });
  const length = (id: string): number => voice.sprite[id as never]?.[1] ?? 0;

  // ---- Unlock and lifecycle ----------------------------------------------------------------------------------------------------------------------------------

  // Only the teacher's pointer or a non-letter key unlocks audio: pupil keyboard switches are letters, and controller buttons never count as a gesture.
  const gesture = (event: Event): void => {
    if (event instanceof KeyboardEvent && /^Key[A-Z]$/.test(event.code)) return;
    if (!unlocked) {
      unlocked = true;
      void loadManifest().then(() => backend.load()).then(() => { ready = true; backend.unlock(); reconcile(); });
    }
    if (backend.unlock()) for (const type of gestures) document.removeEventListener(type, gesture, true);
  };
  const gestures = ['pointerdown', 'pointerup', 'keydown', 'click'] as const;
  for (const type of gestures) document.addEventListener(type, gesture, true);

  // The bed is left to reconcile(), so the title music carries on across screens instead of restarting. Finishing the mission keeps the voice: the last line ("Next stop, home!") is allowed to end before the finale speaks.
  function stopEverything(keepVoice: boolean): void {
    cancelTimers();
    if (keepVoice) queue.flush(); else queue.clear();
    for (const handle of live) handle.stop(40);
    live.clear();
    jingle?.handle.stop(200);
    jingle = null;
    for (const [id, handle] of parked) { handle.stop(200); parked.delete(id); }
    pews.clear(); fireworks.clear(); sparks.clear();
    boostMusic = 'off'; boostTier = 0; boost = null; ducked = false; paused = false;
  }

  // ---- Events ------------------------------------------------------------------------------------------------------------------------------------------------

  events.on('screen', ({ name }) => {
    stopEverything(name === 'finale');
    screen = name;
    reconcile();
  });
  events.on('uiClick', () => playSfx('click'));
  events.on('switchChecked', () => playSfx('boop'));
  events.on('roundStart', ({ round }) => {
    cancelTimers('praise');
    queue.flushTag('round');
    if (round === 1) stars = 0;
    playSfx('deal');
    say(roundLine(round), 'queue', { tag: 'round' });
  });
  events.on('answerCorrect', () => {
    stars++;
    triesSince = 0;
    playSfx('press');
    playSfx('correct', { rate: correctRate(stars) });
    if (!isCalm()) playSfx('fly');
    // Delayed a moment: a round finishing or several pupils answering together gets one line, not a stack.
    if (![...timers.values()].includes('praise')) later(PRAISE_DELAY_MS, 'praise', () => { lastPraise = nextPraise(lastPraise); say(lastPraise, 'drop'); });
  });
  events.on('starLanded', () => { if (!isCalm()) playSfx('collect'); });
  events.on('answerTry', () => {
    playSfx('press');
    playSfx('try');
    triesSince++;
    if (shouldRetryLine(triesSince)) { triesSince = 0; say('another_go', 'drop'); }
  });
  events.on('turnHelped', ({ player, count, narrated }) => {
    playSfx('help');
    cancelTimers('help');
    const lines = helpLines(count);
    const starts = helpSchedule(lines, length, COUNT_FIRST_MS);
    const run = { player, lines, next: 0 };
    if (narrated) helpRun = run;
    const step = (i: number): void => {
      if (narrated && helpRun !== run) return;
      run.next = i + 1;
      if (narrated) events.emit('helpCount', { player, n: i + 1 });
      say(lines[i], 'replace', { tag: 'help' });
      if (i + 1 < lines.length) later(starts[i + 1] - starts[i], 'help', () => step(i + 1));
    };
    if (lines.length) later(starts[0], 'help', () => step(0));
    if (narrated && !lines.length) helpRun = null;
  });
  events.on('sayQuestion', ({ question }) => say(questionLine(question), 'replace', { tag: 'sayit', requested: true }));
  events.on('roundReady', () => {
    cancelTimers('praise');
    playJingle('jingle_round', true);
    say('all_stars', 'queue', { tag: 'round' });
  });
  events.on('destinationReached', ({ destination }) => {
    if (boost?.theme === 'warpDrive' && boost.finale) playSfx('warp_arrive');
    say(welcomeLine(destination), 'queue');
  });
  events.on('homeReached', () => {
    playSfx('warp_arrive');
    say('next_stop_home', 'queue');
  });
  events.on('missionComplete', () => {
    playJingle('jingle_mission', false);
    playSfx('cheer');
    later(800, 'mission', () => say('mission_complete', 'queue'));
  });

  events.on('boostStart', ({ round, theme }) => {
    boost = { round, theme, finale: false };
    boostMusic = 'live';
    boostTier = 0;
    playSfx('slam');
    const [first, ...rest] = introLines(theme, length, COUNTDOWN_FROM_MS);
    cue(first);
    rest.forEach(line => say(line, 'queue', { tag: 'boost' }));
    reconcile();
  });
  events.on('boostCount', ({ n }) => {
    playSfx('beep', { rate: 1 + (3 - n) * 0.12 });
    cue(`count_${n}`);
  });
  events.on('boostGo', () => {
    playSfx('go');
    cue('go');
    say('press_fast', 'queue', { tag: 'boost', expiresMs: PRESS_FAST_WAIT_MS });
    if (boost?.theme === 'warpDrive') playSfx('warp_charge');
  });
  events.on('boostPress', ({ player }) => {
    const now = performance.now();
    const pew = pewParity[player] ? 'pew2' : 'pew';
    const rate = pewRate(player);
    if (pews.take(now, Math.min(PEW_MS, sfx.sprite[pew][1] / rate))) {
      pewParity[player] = !pewParity[player];
      playSfx(pew, { rate, maxMs: PEW_MS });
    }
    if (boost?.theme === 'fireworkFrenzy') {
      if (fireworks.take(now, 500)) {
        playSfx('fw_launch', { maxMs: 500 });
        later(500, 'boost', () => { if (fireworks.take(performance.now(), 700)) playSfx('fw_burst', { maxMs: 700 }); });
      }
    } else if (sparks.take(now, 250)) later(250, 'boost', () => playSfx('spark', { maxMs: 250 }));
  });
  events.on('boostTier', ({ tier }) => {
    boostTier = tier;
    applyMusicVolume(600);
    playSfx(tier === 3 ? 'mega' : 'tierup');
    if (boost?.theme === 'bubbleBlast') playSfx('stretch', { rate: stretchRate(tier) });
    if (tier === 1) cue('tier_boost');
    else if (tier === 2) cue('tier_super');
    else if (boost?.theme === 'warpDrive') cue('hyperspace');
    else if (boost?.theme === 'bubbleBlast') { cue('pop'); say('tier_mega', 'queue', { tag: 'boost', expiresMs: 1500 }); }
    else { cue('max_power'); say('tier_mega', 'queue', { tag: 'boost', expiresMs: 1500 }); }
  });
  events.on('boostFinale', ({ tier }) => {
    if (boost) boost.finale = true;
    boostMusic = 'faded';
    reconcile();
    const theme = boost?.theme;
    if (theme === 'warpDrive') playSfx('warp_launch');
    else if (theme === 'fireworkFrenzy') {
      if (tier === 3) { playSfx('fw_finale'); later(3500, 'boost', () => playSfx('cheer')); } else playSfx('fw_burst');
    } else if (theme === 'bubbleBlast') {
      playSfx('pop');
      if (tier === 3) later(600, 'boost', () => playSfx('giggle'));
    }
  });
  events.on('boostEnd', () => {
    cancelTimers('boost');
    queue.removeTag('boost', performance.now());
    updateDuck();
    boostMusic = 'off';
    boostTier = 0;
    boost = null;
    reconcile();
  });

  events.on('gamePaused', () => {
    if (paused) return;
    paused = true;
    cancelTimers();
    for (const handle of live) handle.pause();
    for (const handle of voiceHandles.values()) handle.pause();
    bed?.handle.pause();
    jingle?.handle.pause();
    if (bed) record('music', 'pause', bed.id);
    voiceHandles.forEach((_, request) => record('voice', 'pause', request.id));
    playSfx('pause');
  });
  events.on('gameResumed', () => {
    if (!paused) return;
    paused = false;
    for (const handle of live) handle.resume();
    for (const handle of voiceHandles.values()) handle.resume();
    bed?.handle.resume();
    jingle?.handle.resume();
    if (bed) record('music', 'resume', bed.id);
    voiceHandles.forEach((_, request) => record('voice', 'resume', request.id));
    playSfx('resume');
    reconcile();
  });

  window.__NC_AUDIO__ = {
    log,
    clear() { log.length = 0; },
    state: () => ({
      backend: backend.kind, unlocked, ready, paused, screen, music: { id: bed?.id ?? null, volume: bed ? bedTarget(bed.id) : 0 }, jingle: jingle?.id ?? null,
      voice: { current: queue.current?.id ?? null, queued: queue.queued }, ducked, boost: { music: boostMusic, tier: boostTier },
      loaded: backend.loaded(),
    }),
  };

  return {
    refresh() {
      if (!active()) return;
      if (queue.current && !voiceAllowed(settings, queue.current.requested)) queue.clear();
      voiceHandles.forEach((handle, request) => handle.volume(voiceGain(settings, request.requested), 100));
      updateDuck();
      reconcile();
    },
    narrating: () => active() && voiceAllowed(settings) && hasVoice('num_1'),
    preview(channel) {
      if (channel === 'voice') say('ready', 'replace', { tag: 'sample', requested: true });
      else playSfx('correct');
    },
  };
}
