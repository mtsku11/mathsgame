import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answerCorrectly, boostFlow, boostPhase, mash, nextButton, openSetup, passAll, skipToRound, startBoostRound, startGame, station, tapKey, wrongSide } from '../helpers';

interface Entry { channel: 'music' | 'sfx' | 'voice'; action: string; id: string; time: number; volume: number; rate?: number }
interface AudioState {
  backend: string; unlocked: boolean; ready: boolean; paused: boolean; music: { id: string | null; volume: number }; jingle: string | null;
  voice: { current: string | null; queued: string[] }; ducked: boolean; boost: { music: string; tier: number }; loaded: { sfx: boolean; voice: boolean; music: string[] };
}
const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as { voice: { sprite: Record<string, number[]> } };
const silent = './?silentaudio';
const KEY = 'number-crew-settings-v2';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};
const audioLog = (page: Page): Promise<Entry[]> => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { log: Entry[] } }).__NC_AUDIO__.log.map(entry => ({ ...entry })));
const audioState = (page: Page): Promise<AudioState> => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { state(): AudioState } }).__NC_AUDIO__.state());
const clearLog = (page: Page): Promise<void> => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { clear(): void } }).__NC_AUDIO__.clear());
const plays = (log: Entry[], channel: Entry['channel']): string[] => log.filter(entry => entry.channel === channel && entry.action === 'play').map(entry => entry.id);
const isPraise = (id: string): boolean => id.startsWith('praise_');
// Voice lines never overlap: each line starts after the previous one ended, or after it was stopped.
function expectNoVoiceOverlap(log: Entry[]): void {
  let endsAt = 0;
  for (const entry of log.filter(item => item.channel === 'voice')) {
    if (entry.action === 'play') { expect(entry.time, `${entry.id} started while a line was playing`).toBeGreaterThanOrEqual(endsAt - 60); endsAt = entry.time + manifest.voice.sprite[entry.id][1]; }
    if (entry.action === 'stop') endsAt = entry.time;
  }
}
// Saves the current settings (a volume change persists them), patches the stored copy and reloads.
async function withStored(page: Page, patch: Record<string, unknown>): Promise<void> {
  await openSetup(page, silent);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Effects volume').selectOption('75');
  await page.evaluate(([key, changes]) => { localStorage.setItem(key as string, JSON.stringify({ ...JSON.parse(localStorage.getItem(key as string)!), ...changes as object })); }, [KEY, patch]);
  await page.reload();
}
const waitVoiceIdle = (page: Page): Promise<void> => expect.poll(async () => (await audioState(page)).voice.current, { timeout: 8000 }).toBeNull();

test.describe.configure({ mode: 'parallel' });

test('nothing is requested to play before the teacher first clicks, and pupil letter keys never unlock audio', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto(silent);
  await expect(page.getByRole('button', { name: 'Teacher setup', exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await audioLog(page)).toEqual([]);
  await page.keyboard.press('f');
  await page.keyboard.press('j');
  await page.waitForTimeout(200);
  expect(await audioLog(page)).toEqual([]);
  expect(await audioState(page)).toMatchObject({ unlocked: false, music: { id: null } });
  await page.getByRole('button', { name: 'Teacher setup', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).music.id).toBe('title');
  const log = await audioLog(page);
  expect(log.find(entry => entry.channel === 'music')).toMatchObject({ id: 'title', action: 'play' });
  expect(log.every(entry => entry.time > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('a normal round: round voice, press, correct chime, one praise line at a time, then the round jingle and "All stars collected"', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, url: silent });
  expect(await audioState(page)).toMatchObject({ music: { id: 'mission' } });
  await waitVoiceIdle(page);
  await clearLog(page);
  await answerCorrectly(page, 0);
  await page.waitForTimeout(300);
  await answerCorrectly(page, 1);
  await expect.poll(async () => plays(await audioLog(page), 'music')).toContain('jingle_round');
  await waitVoiceIdle(page);
  const log = await audioLog(page);
  const sfxPlays = plays(log, 'sfx');
  expect(sfxPlays.slice(0, 2)).toEqual(['press', 'correct']);
  const chimes = log.filter(entry => entry.channel === 'sfx' && entry.id === 'correct');
  expect(chimes).toHaveLength(2);
  expect(chimes[1].rate!).toBeGreaterThan(chimes[0].rate!);
  const voice = plays(log, 'voice');
  expect(voice.filter(isPraise)).toHaveLength(1);
  expect(voice.at(-1)).toBe('all_stars');
  expect(voice.indexOf('all_stars')).toBeGreaterThan(voice.findIndex(isPraise));
  expectNoVoiceOverlap(log);
  expect(log.findIndex(entry => entry.id === 'jingle_round')).toBeGreaterThan(log.findIndex(entry => entry.id === 'correct'));
  expect(errors).toEqual([]);
});

test('simultaneous correct answers from all four pupils produce a single praise line', async ({ page }) => {
  await startGame(page, { count: 4, url: silent });
  await waitVoiceIdle(page);
  await clearLog(page);
  const sides = await Promise.all([0, 1, 2, 3].map(async index => {
    const target = station(page, index);
    const total = await target.locator('.sp-obj').count();
    const values = await target.locator('.sp-btn').evaluateAll(buttons => buttons.map(button => Number(button.getAttribute('aria-label')!.split(', ').pop())));
    return values.indexOf(total);
  }));
  await page.evaluate(([codes]) => {
    (codes as string[]).forEach(code => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase() })));
    setTimeout(() => (codes as string[]).forEach(code => window.dispatchEvent(new KeyboardEvent('keyup', { code }))), 40);
  }, [sides.map((side, index) => [['KeyF', 'KeyJ'], ['KeyA', 'KeyL'], ['KeyC', 'KeyM'], ['KeyQ', 'KeyP']][index][side])]);
  await expect.poll(async () => plays(await audioLog(page), 'music')).toContain('jingle_round');
  const log = await audioLog(page);
  expect(plays(log, 'sfx').filter(id => id === 'correct')).toHaveLength(4);
  expect(plays(log, 'voice').filter(isPraise)).toHaveLength(0);
  expect(plays(log, 'voice')).toEqual(['all_stars']);
});

test('a wrong answer plays a soft try sound, and "Have another go" is occasional and never stacks', async ({ page }) => {
  await startGame(page, { count: 1, url: silent });
  await waitVoiceIdle(page);
  await clearLog(page);
  const target = station(page, 0);
  for (let i = 0; i < 4; i++) {
    await target.locator('.sp-btn').nth(await wrongSide(target)).click();
    await page.waitForTimeout(650);
  }
  const log = await audioLog(page);
  expect(plays(log, 'sfx').filter(id => id === 'try')).toHaveLength(4);
  expect(plays(log, 'voice')).toEqual(['another_go']);
  expectNoVoiceOverlap(log);
});

test('help counts aloud one line at a time, and praise rotates without repeating', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 1, url: silent, presets: ['count'] });
  await waitVoiceIdle(page);
  await clearLog(page);
  const total = await station(page, 0).locator('.sp-obj').count();
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect.poll(async () => plays(await audioLog(page), 'voice').length, { timeout: 20000 }).toBe(total);
  const log = await audioLog(page);
  expect(plays(log, 'voice')).toEqual(Array.from({ length: total }, (_, i) => `num_${i + 1}`));
  expect(plays(log, 'sfx')).toContain('help');
  expectNoVoiceOverlap(log);
  await page.waitForTimeout(500);
  await clearLog(page);
  const praised: string[] = [];
  for (let round = 1; round <= 3; round++) {
    await waitVoiceIdle(page);
    await answerCorrectly(page, 0);
    await page.waitForTimeout(400);
    if (round < 3) { await nextButton(page).click(); await page.waitForTimeout(300); }
  }
  for (const id of plays(await audioLog(page), 'voice')) if (isPraise(id)) praised.push(id);
  praised.forEach((id, i) => { if (i) expect(id).not.toBe(praised[i - 1]); });
});

const badgeStates = (page: Page): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.sp-badge')].map(badge => badge.style.transform));

test('help: the numbers pop in step with the spoken count, and all at once quickly when the voice is off', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 1, url: silent, presets: ['add5'] });
  await waitVoiceIdle(page);
  await clearLog(page);
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await page.waitForTimeout(60);
  const total = (await badgeStates(page)).length;
  expect(total).toBeGreaterThanOrEqual(2);
  expect((await badgeStates(page)).every(transform => transform.includes('scale(0'))).toBe(true);
  await expect.poll(async () => (await badgeStates(page))[0], { timeout: 3000 }).toBe('');
  expect((await badgeStates(page)).at(-1)).toContain('scale(0');
  await expect.poll(async () => (await badgeStates(page)).every(transform => transform === ''), { timeout: 20000 }).toBe(true);
  expect(plays(await audioLog(page), 'voice')).toEqual(Array.from({ length: total }, (_, i) => `num_${i + 1}`));

  await withStored(page, { narration: false });
  await startGame(page, { count: 1, url: silent, presets: ['add5'] });
  await clearLog(page);
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect.poll(async () => (await badgeStates(page)).every(transform => transform === ''), { timeout: 3000 }).toBe(true);
  expect(plays(await audioLog(page), 'voice')).toEqual([]);
});

test('help numbers are not left hidden when the game is paused mid-count', async ({ page }) => {
  await startGame(page, { count: 1, url: silent, presets: ['add5'] });
  await waitVoiceIdle(page);
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await badgeStates(page)).every(transform => transform === ''), { timeout: 3000 }).toBe(true);
});

test('a new round flushes queued round lines, so no stale "All stars collected" or round number is heard', async ({ page }) => {
  await startGame(page, { count: 1, url: silent });
  expect((await audioState(page)).voice.current).toBe('round_1');
  await passAll(page, 1);
  await expect.poll(async () => (await audioState(page)).voice.queued).toEqual(['all_stars']);
  await nextButton(page).click();
  await expect.poll(async () => (await audioState(page)).voice.queued).toEqual(['round_2']);
  await waitVoiceIdle(page);
  expect(plays(await audioLog(page), 'voice')).toEqual(['round_1', 'round_2']);
});

test('low stimulation plays only acknowledgements: no music, stingers, cheers or praise', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await withStored(page, { lowStim: true });
  await startGame(page, { count: 2, url: silent });
  const target = station(page, 0);
  await target.locator('.sp-btn').nth(await wrongSide(target)).click();
  await page.waitForTimeout(800);
  await answerCorrectly(page, 0);
  await answerCorrectly(page, 1);
  await expect(nextButton(page)).toBeVisible();
  await page.waitForTimeout(600);
  const log = await audioLog(page);
  expect(plays(log, 'music')).toEqual([]);
  expect(plays(log, 'voice')).toEqual([]);
  const allowed = new Set(['click', 'press', 'correct', 'try', 'boop']);
  expect(plays(log, 'sfx').filter(id => !allowed.has(id))).toEqual([]);
  expect(plays(log, 'sfx')).toEqual(expect.arrayContaining(['press', 'try', 'correct']));
  expect(await audioState(page)).toMatchObject({ music: { id: null } });
  expect(errors).toEqual([]);
});

test('narration off silences the voice but effects and music still play', async ({ page }) => {
  await openSetup(page, silent);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Voice narration').uncheck();
  await page.getByLabel('Crew size').selectOption('2');
  await page.getByLabel('Boost round after every maths round').uncheck();
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await expect(page.locator('.sp-st').first()).toBeVisible();
  await answerCorrectly(page, 0);
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await answerCorrectly(page, 1);
  await expect.poll(async () => plays(await audioLog(page), 'music')).toContain('jingle_round');
  const log = await audioLog(page);
  expect(plays(log, 'voice')).toEqual([]);
  expect(plays(log, 'sfx')).toEqual(expect.arrayContaining(['deal', 'press', 'correct']));
  expect(plays(log, 'music')).toContain('mission');
});

test('quiet mode plays nothing at all', async ({ page }) => {
  const errors = errorsOf(page);
  await withStored(page, { quiet: true });
  await startGame(page, { count: 2, url: silent });
  await clearLog(page);
  await answerCorrectly(page, 0);
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await answerCorrectly(page, 1);
  await expect(nextButton(page)).toBeVisible();
  await page.waitForTimeout(500);
  expect((await audioLog(page)).filter(entry => entry.action === 'play')).toEqual([]);
  expect(errors).toEqual([]);
});

test('pause pauses music and the voice line, time stands still, and resume restores them', async ({ page }) => {
  await startGame(page, { count: 2, url: silent });
  await waitVoiceIdle(page);
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await expect.poll(async () => (await audioState(page)).voice.current).toBe('how_many');
  await clearLog(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  let log = await audioLog(page);
  expect(log.filter(entry => entry.action === 'pause').map(entry => `${entry.channel}:${entry.id}`)).toEqual(expect.arrayContaining(['music:mission', 'voice:how_many']));
  expect(plays(log, 'sfx')).toContain('pause');
  expect(await audioState(page)).toMatchObject({ paused: true, voice: { current: 'how_many' } });
  await page.waitForTimeout(3200);
  expect((await audioState(page)).voice.current).toBe('how_many');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  log = await audioLog(page);
  expect(log.filter(entry => entry.action === 'resume').map(entry => `${entry.channel}:${entry.id}`)).toEqual(expect.arrayContaining(['music:mission', 'voice:how_many']));
  expect(plays(log, 'sfx')).toContain('resume');
  await waitVoiceIdle(page);
  expect(await audioState(page)).toMatchObject({ paused: false, music: { id: 'mission' } });
});

test('ending the journey stops the bed and returns to the title music', async ({ page }) => {
  await startGame(page, { count: 2, url: silent });
  await page.keyboard.press('Escape');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'End journey & return to setup' }).click();
  await expect(page.getByLabel('Crew size')).toBeVisible();
  await expect.poll(async () => (await audioState(page)).music.id).toBe('title');
  expect(await audioState(page)).toMatchObject({ voice: { current: null }, paused: false });
});

test('"Say it" reads only that pupil\'s question and replaces a playing "Say it" line', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 3, url: silent, presets: ['add5', 'count', 'add10'] });
  await waitVoiceIdle(page);
  await clearLog(page);
  const prompt = async (index: number): Promise<string> => (await station(page, index).locator('.sp-prompt').innerText()).replace(/\s/g, '');
  const [a, b] = (await prompt(0)).split('=')[0].split('+');
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await expect.poll(async () => (await audioState(page)).voice.current).toBe(`add_${a}_${b}`);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Say Blue\'s question' }).click();
  await expect.poll(async () => (await audioState(page)).voice.current).toBe('how_many');
  const [c, d] = (await prompt(2)).split('=')[0].split('+');
  await page.getByRole('button', { name: 'Say Orange\'s question' }).click();
  await expect.poll(async () => (await audioState(page)).voice.current).toBe(`add_${c}_${d}`);
  const log = await audioLog(page);
  expect(plays(log, 'voice')).toEqual([`add_${a}_${b}`, 'how_many', `add_${c}_${d}`]);
  expect(log.filter(entry => entry.channel === 'voice' && entry.action === 'stop').map(entry => entry.id)).toEqual([`add_${a}_${b}`, 'how_many']);
  expectNoVoiceOverlap(log);
  await expect(page.getByRole('button', { name: 'Say Pink\'s question' })).toBeEnabled();
});

test('the "Say it" buttons are native ghost buttons that stay clear of the answer buttons', async ({ page }) => {
  for (const count of [1, 2, 3, 4]) {
    await startGame(page, { count, url: silent });
    for (let index = 0; index < count; index++) {
      const say = station(page, index).locator('[data-say]');
      expect(await say.evaluate(button => button.tagName)).toBe('BUTTON');
      await expect(say).toHaveClass(/sp-ghost/);
      const box = (await say.boundingBox())!;
      for (const answer of await station(page, index).locator('.sp-btn').all()) {
        const other = (await answer.boundingBox())!;
        const apart = box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y;
        expect(apart, `player ${index + 1} Say it overlaps an answer at ${count} players`).toBe(true);
      }
    }
    await page.goto(silent);
  }
});

test('boost round audio: countdown beeps and GO, boost music with rising tier volume, stingers, pews, then a clean return to maths', async ({ page }) => {
  test.setTimeout(120000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, url: silent, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
  await waitVoiceIdle(page);
  await passAll(page, 2);
  await expect.poll(async () => plays(await audioLog(page), 'music')).toContain('jingle_round');
  await clearLog(page);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostFlow(page)).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.id, { timeout: 3000 }).toBe('boost');
  await expect.poll(async () => plays(await audioLog(page), 'sfx').filter(id => id === 'beep').length, { timeout: 8000 }).toBe(3);
  await expect.poll(async () => plays(await audioLog(page), 'sfx'), { timeout: 8000 }).toContain('go');
  let log = await audioLog(page);
  // boost_round and a theme line cannot both finish before the countdown's "3", so the theme line is dropped, never cut.
  expect(plays(log, 'voice').slice(0, 5)).toEqual(['boost_round', 'count_3', 'count_2', 'count_1', 'go']);
  expect(log.filter(entry => entry.channel === 'voice' && entry.action === 'stop').map(entry => entry.id)).not.toContain('boost_round');
  expect(plays(log, 'sfx').filter(id => id !== 'click').slice(0, 5)).toEqual(['slam', 'beep', 'beep', 'beep', 'go']);
  const parked = log.find(entry => entry.channel === 'music' && entry.action === 'pause');
  expect(parked).toMatchObject({ id: 'mission' });
  expect(await audioState(page)).toMatchObject({ boost: { music: 'live', tier: 0 } });
  const before = (await audioState(page)).music.volume;

  await mash(page, { mode: 'keys', pupils: [0, 1], ms: 15000, untilNotLive: true });
  log = await audioLog(page);
  const pews = plays(log, 'sfx').filter(id => id === 'pew' || id === 'pew2');
  expect(pews.length).toBeGreaterThan(5);
  const bursts = log.filter(entry => entry.id === 'pew' || entry.id === 'pew2');
  for (const entry of bursts) expect(bursts.filter(other => other.time <= entry.time && other.time > entry.time - 280).length).toBeLessThanOrEqual(8);
  expect(new Set(bursts.map(entry => entry.rate)).size).toBeGreaterThan(1);
  expect(plays(log, 'sfx')).toEqual(expect.arrayContaining(['tierup', 'mega']));
  const musicVolumes = log.filter(entry => entry.channel === 'music' && entry.action === 'volume' && entry.id === 'boost').map(entry => entry.volume);
  expect(musicVolumes.length).toBeGreaterThan(2);
  expect(Math.max(...musicVolumes)).toBeGreaterThan(before);
  expect(plays(log, 'voice')).toEqual(expect.arrayContaining(['tier_boost', 'tier_super']));
  expect(log.some(entry => entry.channel === 'sfx' && entry.action === 'play' && (entry.id === 'fw_finale' || entry.id === 'warp_launch' || entry.id === 'pop'))).toBe(true);

  await expect.poll(() => boostFlow(page), { timeout: 20000 }).toBe('done');
  await expect.poll(async () => (await audioState(page)).music.id, { timeout: 4000 }).toBe('mission');
  log = await audioLog(page);
  const stop = log.findIndex(entry => entry.channel === 'music' && entry.action === 'stop' && entry.id === 'boost');
  const resume = log.findIndex(entry => entry.channel === 'music' && entry.action === 'resume' && entry.id === 'mission');
  expect(stop).toBeGreaterThan(-1);
  expect(resume).toBeGreaterThan(stop);
  expect(await audioState(page)).toMatchObject({ boost: { music: 'off', tier: 0 } });
  await clearLog(page);
  await nextButton(page).click();
  await expect.poll(async () => plays(await audioLog(page), 'voice')).toContain('round_2');
  expectNoVoiceOverlap(await audioLog(page));
  expect(errors).toEqual([]);
});

test('a boost that times out at tier 1 still plays its finale sound and fades the boost track out', async ({ page }) => {
  test.setTimeout(120000);
  await startGame(page, { count: 1, url: silent, boost: { autoStart: false, seconds: 8, difficulty: 'hard' } });
  await startBoostRound(page, 1);
  await clearLog(page);
  await tapKey(page, 0, 0); await page.waitForTimeout(150);
  for (let i = 0; i < 12; i++) { await tapKey(page, 0, i % 2 as 0 | 1); await page.waitForTimeout(90); }
  await expect.poll(() => boostFlow(page), { timeout: 30000 }).toBe('done');
  const log = await audioLog(page);
  expect(log.some(entry => entry.channel === 'music' && entry.action === 'stop' && entry.id === 'boost')).toBe(true);
  expect(plays(log, 'sfx')).not.toContain('mega');
});

test('the finale plays the mission jingle and mission-complete line once, after the crew reaches home', async ({ page }) => {
  test.setTimeout(120000);
  await startGame(page, { count: 1, url: silent });
  for (let round = 1; round <= 6; round++) {
    await passAll(page, 1);
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await expect.poll(async () => plays(await audioLog(page), 'voice'), { timeout: 15000 }).toContain('mission_complete');
  const log = await audioLog(page);
  expect(plays(log, 'music').filter(id => id === 'jingle_mission')).toHaveLength(1);
  expect(plays(log, 'voice').filter(id => id === 'mission_complete')).toHaveLength(1);
  expect((await audioState(page)).music.id).toBeNull();
});

test('Warp Drive at MAX: hyperspace voice and launch, then the destination welcome and arrival sound', async ({ page }) => {
  test.setTimeout(120000);
  const errors = errorsOf(page);
  await startGame(page, { count: 1, url: silent, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
  await skipToRound(page, 1, 2);
  await waitVoiceIdle(page);
  await clearLog(page);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await mash(page, { mode: 'keys', pupils: [0], ms: 15000, untilNotLive: true });
  await expect.poll(async () => plays(await audioLog(page), 'voice'), { timeout: 15000 }).toContain('welcome_candy_planet');
  const log = await audioLog(page);
  expect(plays(log, 'sfx')).toEqual(expect.arrayContaining(['warp_charge', 'warp_launch', 'warp_arrive', 'mega']));
  expect(plays(log, 'voice')).toEqual(expect.arrayContaining(['hyperspace']));
  expect(plays(log, 'voice').indexOf('welcome_candy_planet')).toBeGreaterThan(plays(log, 'voice').indexOf('hyperspace'));
  expectNoVoiceOverlap(log);
  expect(errors).toEqual([]);
});

test('music ducks to about a third under a voice line and restores afterwards', async ({ page }) => {
  await startGame(page, { count: 2, url: silent });
  await waitVoiceIdle(page);
  await expect.poll(async () => (await audioState(page)).ducked).toBe(false);
  const rest = (await audioState(page)).music.volume;
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await expect.poll(async () => (await audioState(page)).ducked).toBe(true);
  const ducked = (await audioState(page)).music.volume;
  expect(ducked / rest).toBeGreaterThan(0.3);
  expect(ducked / rest).toBeLessThan(0.36);
  await waitVoiceIdle(page);
  expect((await audioState(page)).music.volume).toBeCloseTo(rest, 5);
});

test('teacher volume controls: music, effects and voice volumes and narration work in setup and in the pause overlay and persist', async ({ page }) => {
  await openSetup(page, silent);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Music volume').selectOption('25');
  await page.getByLabel('Voice volume').selectOption('50');
  await page.getByLabel('Effects volume').selectOption('100');
  await page.getByLabel('Voice narration').uncheck();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(saved).toMatchObject({ musicVolume: 25, voiceVolume: 50, effectsVolume: 100, narration: false });
  await page.reload();
  await enterAndLaunch(page);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Music volume')).toHaveValue('25');
  await expect(page.getByLabel('Voice volume')).toHaveValue('50');
  await expect(page.getByLabel('Effects volume')).toHaveValue('100');
  await expect(page.getByLabel('Voice narration')).not.toBeChecked();
  await page.getByLabel('Voice narration').check();
  await page.getByLabel('Music volume').selectOption('100');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY)).toMatchObject({ musicVolume: 100, narration: true });
  expect((await audioState(page)).music.volume).toBeCloseTo(1, 5);
});

async function enterAndLaunch(page: Page): Promise<void> {
  const teacher = page.getByRole('button', { name: 'Teacher setup', exact: true });
  await teacher.click();
  await page.getByLabel('Boost round after every maths round').uncheck();
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await expect(page.locator('.sp-st').first()).toBeVisible();
}

test('real audio: sprites and music decode, the context runs, and the title track loops its inner region without a gap', async ({ page }) => {
  const errors = errorsOf(page);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/audio/')) requests.push(new URL(request.url()).pathname); });
  await page.addInitScript(() => {
    const w = window as unknown as { __sources: object[]; __ctxs: AudioContext[] };
    w.__sources = []; w.__ctxs = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: [number?, number?, number?]) {
      w.__sources.push({ loop: this.loop, loopStart: this.loopStart, loopEnd: this.loopEnd, seconds: this.buffer?.duration, offset: args[1] });
      return start.apply(this, args);
    };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original { constructor(...args: ConstructorParameters<typeof Original>) { super(...args); w.__ctxs.push(this); } };
  });
  await page.goto('./');
  await expect.poll(async () => (await audioState(page)).unlocked).toBe(false);
  expect(await audioLog(page)).toEqual([]);
  await page.getByRole('button', { name: 'Teacher setup', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).ready, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await audioState(page)).loaded, { timeout: 20000 }).toMatchObject({ sfx: true, voice: true });
  await expect.poll(async () => (await audioState(page)).loaded.music.length, { timeout: 20000 }).toBe(5);
  await expect.poll(async () => (await audioState(page)).music.id).toBe('title');
  expect(await audioState(page)).toMatchObject({ backend: 'howler', unlocked: true });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.some(ctx => ctx.state === 'running'))).toBe(true);
  const sources = await page.evaluate(() => (window as unknown as { __sources: { loop: boolean; loopStart: number; loopEnd: number; seconds: number; offset: number }[] }).__sources);
  const title = sources.find(source => Math.abs(source.seconds - 37.56) < 0.5)!;
  expect(title).toMatchObject({ loop: true, loopStart: 7.44, loopEnd: 44.94, offset: 0 });
  expect(requests.some(url => url.endsWith('/audio/sfx.webm'))).toBe(true);
  expect(requests.some(url => url.endsWith('/audio/voice.webm'))).toBe(true);
  expect(requests.some(url => url.endsWith('/audio/manifest.json'))).toBe(true);
  expect(errors).toEqual([]);
});
