import raw from '../../public/audio/manifest.json';
import { beforeAll, describe, expect, it } from 'vitest';
import { hasVoice, music, sfx, useManifest, voice, type SfxId } from '../../src/audio/manifest';
import {
  BOOST_MUSIC_STEPS, DUCK_LEVEL, LOW_STIM_SFX, MAX_WAITING, OverlapLimiter, PRAISE, VoiceQueue, boostStep, correctRate, duckLevel, helpLines, musicAllowed, musicGain, nextPraise, pewRate,
  questionLine, roundLine, sfxAllowed, sfxGain, shouldRetryLine, voiceAllowed, voiceGain, wantedMusic, welcomeLine, type AudioSettings, type VoiceRequest,
} from '../../src/audio/rules';
import { question } from '../../src/game/questions';

beforeAll(() => useManifest(raw));

const base: AudioSettings = { quiet: false, effectsVolume: 75, musicVolume: 50, voiceVolume: 100, narration: true, lowStim: false };
const settings = (patch: Partial<AudioSettings> = {}): AudioSettings => ({ ...base, ...patch });

describe('channel volume maths', () => {
  it('scales each channel by its own setting', () => {
    expect(musicGain(settings({ musicVolume: 50 }), false)).toBe(0.5);
    expect(sfxGain(settings({ effectsVolume: 50 }), 'correct', 0.8)).toBeCloseTo(0.4);
    expect(voiceGain(settings({ voiceVolume: 25 }))).toBe(0.25);
    expect(musicGain(settings({ musicVolume: 100 }), false)).toBe(1);
  });
  it('volume 0 silences only that channel', () => {
    const s = settings({ musicVolume: 0 });
    expect(musicGain(s, false)).toBe(0);
    expect(sfxGain(s, 'correct', 0.8)).toBeGreaterThan(0);
    expect(voiceGain(s)).toBe(1);
    expect(sfxGain(settings({ effectsVolume: 0 }), 'correct', 0.8)).toBe(0);
    expect(voiceGain(settings({ voiceVolume: 0 }))).toBe(0);
  });
  it('quiet mutes every channel at every volume', () => {
    const s = settings({ quiet: true, effectsVolume: 100, musicVolume: 100, voiceVolume: 100 });
    expect([musicAllowed(s), sfxAllowed('click', s), voiceAllowed(s), voiceAllowed(s, true)]).toEqual([false, false, false, false]);
    expect([musicGain(s, false), sfxGain(s, 'click', 1), voiceGain(s)]).toEqual([0, 0, 0]);
  });
});

describe('gating', () => {
  it('narration off silences voice only', () => {
    const s = settings({ narration: false });
    expect(voiceAllowed(s)).toBe(false);
    expect(voiceAllowed(s, true)).toBe(false);
    expect(sfxAllowed('cheer', s)).toBe(true);
    expect(musicAllowed(s)).toBe(true);
  });
  it('low stimulation keeps only acknowledgements and turns music and voice praise off', () => {
    const s = settings({ lowStim: true });
    expect(musicAllowed(s)).toBe(false);
    expect(voiceAllowed(s)).toBe(false);
    for (const id of Object.keys(sfx.sprite) as SfxId[]) expect(sfxAllowed(id, s), id).toBe(LOW_STIM_SFX.includes(id));
    expect(LOW_STIM_SFX).toEqual(['click', 'press', 'correct', 'try', 'boop']);
  });
  it('a line the teacher asked for still plays in low stimulation, but not in quiet or with narration off', () => {
    expect(voiceAllowed(settings({ lowStim: true }), true)).toBe(true);
    expect(voiceAllowed(settings({ lowStim: true, narration: false }), true)).toBe(false);
  });
});

describe('ducking and boost music', () => {
  it('ducks music to a third while a voice line plays', () => {
    expect(DUCK_LEVEL).toBeGreaterThanOrEqual(0.3);
    expect(DUCK_LEVEL).toBeLessThanOrEqual(0.35);
    expect(duckLevel(true)).toBe(DUCK_LEVEL);
    expect(duckLevel(false)).toBe(1);
    expect(musicGain(settings({ musicVolume: 100 }), true)).toBe(DUCK_LEVEL);
  });
  it('boost music gets louder tier by tier and ends at full volume', () => {
    expect(BOOST_MUSIC_STEPS).toHaveLength(4);
    for (let tier = 1; tier <= 3; tier++) expect(boostStep(tier)).toBeGreaterThan(boostStep(tier - 1));
    expect(boostStep(3)).toBe(1);
    expect(boostStep(9)).toBe(1);
    expect(musicGain(settings({ musicVolume: 100 }), false, 0)).toBe(BOOST_MUSIC_STEPS[0]);
    expect(musicGain(settings({ musicVolume: 100 }), true, 3)).toBe(DUCK_LEVEL);
  });
  it('chooses the music from the screen and the boost state', () => {
    expect(wantedMusic('title', 'off')).toBe('title');
    expect(wantedMusic('legacy', 'off')).toBe('title');
    expect(wantedMusic('play', 'off')).toBe('mission');
    expect(wantedMusic('play', 'live')).toBe('boost');
    expect(wantedMusic('play', 'faded')).toBeNull();
    expect(wantedMusic('finale', 'off')).toBeNull();
    expect(wantedMusic(null, 'off')).toBeNull();
  });
});

describe('pitch and rate', () => {
  it('the correct chime climbs a pentatonic scale with the crew total, then climbs again', () => {
    const rates = [1, 2, 3, 4, 5, 6, 7].map(correctRate);
    expect(rates[0]).toBe(1);
    for (let i = 1; i < 6; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    expect(rates[5]).toBeCloseTo(2);
    expect(rates[6]).toBe(1);
    expect(correctRate(0)).toBe(1);
  });
  it('each pupil has their own pew pitch', () => {
    expect(new Set([0, 1, 2, 3].map(pewRate)).size).toBe(4);
    expect(pewRate(0)).toBe(1);
  });
});

describe('overlap limiting', () => {
  it('lets at most 8 pews overlap however many pupils press at once', () => {
    const limiter = new OverlapLimiter(8);
    const taken = Array.from({ length: 40 }, () => limiter.take(1000, 400)).filter(Boolean);
    expect(taken).toHaveLength(8);
    expect(limiter.take(1399, 400)).toBe(false);
    expect(limiter.take(1400, 400)).toBe(true);
  });
  it('never has more than max overlapping over a mashing run of four pupils', () => {
    const limiter = new OverlapLimiter(8);
    const starts: number[] = [];
    for (let t = 0; t < 4000; t += 12) if (limiter.take(t, 400)) starts.push(t);
    for (const start of starts) expect(starts.filter(other => other <= start && other > start - 400).length).toBeLessThanOrEqual(8);
    expect(starts.length).toBeGreaterThan(50);
  });
});

describe('voice queue', () => {
  const fixture = () => {
    const started: string[] = [], stopped: string[] = [];
    const queue = new VoiceQueue({ start: request => started.push(request.id), stop: request => stopped.push(request.id) });
    const line = (id: string, policy: VoiceRequest['policy'], extra: Partial<VoiceRequest> = {}): VoiceRequest => ({ id, policy, ...extra });
    return { queue, started, stopped, line };
  };

  it('plays priority lines in order and only one at a time', () => {
    const { queue, started, line } = fixture();
    const a = line('round_1', 'queue'), b = line('all_stars', 'queue'), c = line('boost_round', 'queue');
    expect(queue.request(a, 0)).toBe('played');
    expect(queue.request(b, 10)).toBe('queued');
    expect(queue.request(c, 20)).toBe('queued');
    expect(started).toEqual(['round_1']);
    queue.finished(a, 100);
    expect(started).toEqual(['round_1', 'all_stars']);
    queue.finished(b, 200);
    queue.finished(c, 300);
    expect(started).toEqual(['round_1', 'all_stars', 'boost_round']);
    expect(queue.current).toBeNull();
  });

  it('drops praise while a line is playing or waiting, and plays it when idle', () => {
    const { queue, started, line } = fixture();
    const round = line('round_1', 'queue');
    queue.request(round, 0);
    expect(queue.request(line('praise_awesome', 'drop'), 5)).toBe('dropped');
    queue.finished(round, 50);
    const praise = line('praise_awesome', 'drop');
    expect(queue.request(praise, 60)).toBe('played');
    expect(queue.request(line('praise_nice_one', 'drop'), 61)).toBe('dropped');
    queue.request(line('all_stars', 'queue'), 62);
    expect(queue.request(line('praise_well_done', 'drop'), 63)).toBe('dropped');
    expect(started).toEqual(['round_1', 'praise_awesome']);
  });

  it('a cut replaces what is playing and forgets the queue', () => {
    const { queue, started, stopped, line } = fixture();
    queue.request(line('boost_round', 'queue'), 0);
    queue.request(line('press_fast', 'queue'), 1);
    queue.request(line('count_3', 'cut'), 2);
    expect(started).toEqual(['boost_round', 'count_3']);
    expect(stopped).toEqual(['boost_round']);
    expect(queue.queued).toEqual([]);
  });

  it('a replace swaps a playing or waiting line with the same tag and otherwise queues', () => {
    const { queue, started, stopped, line } = fixture();
    queue.request(line('round_1', 'queue'), 0);
    queue.request(line('how_many', 'replace', { tag: 'sayit' }), 1);
    queue.request(line('add_2_3', 'replace', { tag: 'sayit' }), 2);
    expect(queue.queued).toEqual(['add_2_3']);
    expect(started).toEqual(['round_1']);
    const first = queue.current!;
    queue.finished(first, 10);
    expect(queue.current?.id).toBe('add_2_3');
    queue.request(line('add_4_1', 'replace', { tag: 'sayit' }), 20);
    expect(queue.current?.id).toBe('add_4_1');
    expect(stopped).toEqual(['add_2_3']);
    expect(queue.queued).toEqual([]);
  });

  it('skips waiting lines that have expired', () => {
    const { queue, started, line } = fixture();
    const go = line('go', 'queue');
    queue.request(go, 0);
    queue.request(line('press_fast', 'queue', { expiresMs: 1000 }), 0);
    queue.request(line('round_2', 'queue'), 0);
    queue.finished(go, 1600);
    expect(started).toEqual(['go', 'round_2']);
  });

  it('a full queue drops its oldest waiting line, and a stale finish is ignored', () => {
    const { queue, started, line } = fixture();
    const first = line('round_1', 'queue');
    queue.request(first, 0);
    for (let i = 0; i < MAX_WAITING + 2; i++) queue.request(line(`add_1_${i + 1}`, 'queue'), i);
    expect(queue.queued).toHaveLength(MAX_WAITING);
    expect(queue.queued.at(-1)).toBe(`add_1_${MAX_WAITING + 2}`);
    queue.request(line('go', 'cut'), 50);
    queue.finished(first, 60);
    expect(started.at(-1)).toBe('go');
    expect(queue.current?.id).toBe('go');
  });

  it('removeTag stops a tagged line and moves on, and flush keeps the current line', () => {
    const { queue, started, stopped, line } = fixture();
    queue.request(line('boost_round', 'queue', { tag: 'boost' }), 0);
    queue.request(line('round_2', 'queue'), 1);
    queue.removeTag('boost', 5);
    expect(stopped).toEqual(['boost_round']);
    expect(started).toEqual(['boost_round', 'round_2']);
    queue.request(line('all_stars', 'queue'), 6);
    queue.flush();
    expect(queue.queued).toEqual([]);
    expect(queue.current?.id).toBe('round_2');
    queue.clear();
    expect(queue.current).toBeNull();
    expect(stopped).toEqual(['boost_round', 'round_2']);
  });
});

describe('lines', () => {
  it('praise rotates and never repeats the last line', () => {
    let last: string | null = null;
    let seed = 7;
    const random = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const next = nextPraise(last, random);
      expect(next).not.toBe(last);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBe(PRAISE.length);
    for (const value of [0, 0.5, 0.999]) expect(nextPraise(PRAISE[0], () => value)).not.toBe(PRAISE[0]);
  });
  it('"Have another go" only every third try', () => {
    expect([0, 1, 2, 3, 4].map(shouldRetryLine)).toEqual([false, false, false, true, true]);
  });
  it('maps every question the game can ask to a recorded line', () => {
    let seed = 3;
    const random = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const preset of ['count', 'add5', 'add10'] as const) for (let i = 0; i < 400; i++) expect(hasVoice(questionLine(question(preset, random))), preset).toBe(true);
    expect(questionLine({ kind: 'count', groups: [3] })).toBe('how_many');
    expect(questionLine({ kind: 'add', groups: [3, 2] })).toBe('add_3_2');
  });
  it('has a recorded line for every round, welcome, praise and help count', () => {
    for (let round = 1; round <= 6; round++) expect(hasVoice(roundLine(round))).toBe(true);
    for (let stop = 0; stop < 3; stop++) expect(hasVoice(welcomeLine(stop))).toBe(true);
    for (const id of PRAISE) expect(hasVoice(id)).toBe(true);
    for (const id of helpLines(10)) expect(hasVoice(id)).toBe(true);
    expect(helpLines(3)).toEqual(['num_1', 'num_2', 'num_3']);
    expect(helpLines(14)).toHaveLength(10);
    for (const id of ['all_stars', 'another_go', 'boost_round', 'press_fast', 'count_3', 'count_2', 'count_1', 'go', 'tier_boost', 'tier_super', 'tier_mega', 'max_power', 'hyperspace', 'pop', 'next_stop_home', 'mission_complete', 'ready'])
      expect(hasVoice(id), id).toBe(true);
  });
  it('the manifest carries every track with loop points where it loops', () => {
    expect(Object.keys(music).sort()).toEqual(['boost', 'jingle_mission', 'jingle_round', 'mission', 'title']);
    for (const entry of Object.values(music).filter(item => item.loop)) expect(entry.loopTo! > entry.loopFrom!).toBe(true);
    expect(Object.keys(voice.sprite).length).toBe(Object.keys(voice.text).length);
  });
});
