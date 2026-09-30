import { test, expect, type Page } from '@playwright/test';
import {
  boostFlow, boostLog, boostPhase, boostState, countOf, mapAndCheck, mash, nextButton, passAll, pupilKeys, recordBoost, setButtons, setConnected, startBoostRound, startController, startGame, tapKey, type Logged,
} from '../helpers';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};
const names = (log: Logged[], ...wanted: string[]): string[] => log.filter(entry => wanted.includes(entry.name)).map(entry => entry.name === 'boostTier' || entry.name === 'boostFinale' || entry.name === 'boostEnd' ? `${entry.name}${entry.payload?.tier}` : entry.name);
const untilDone = (page: Page, timeout = 20000): Promise<void> => expect.poll(() => boostFlow(page), { timeout }).toBe('done');
const easy = { autoStart: false, seconds: 20, difficulty: 'easy' } as const;

test.describe.configure({ mode: 'parallel' });

test('four pupils on a shared XAC: tiers 1, 2 and 3 fire in order and MAX ends the live phase early', async ({ page }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await startController(page, { count: 4, boost: easy });
  await recordBoost(page);
  await startBoostRound(page, 4);
  await mash(page, { mode: 'xac', pupils: [0, 1, 2, 3], ms: 15000, untilNotLive: true });
  const log = await boostLog(page);
  const flow = names(log, 'boostStart', 'boostGo', 'boostTier', 'boostFinale');
  expect(flow).toEqual(['boostStart', 'boostGo', 'boostTier1', 'boostTier2', 'boostTier3', 'boostFinale3']);
  const presses = log.filter(entry => entry.name === 'boostPress');
  expect(new Set(presses.map(entry => entry.payload!.player))).toEqual(new Set([0, 1, 2, 3]));
  expect(new Set(presses.map(entry => entry.payload!.side))).toEqual(new Set([0, 1]));
  const go = log.find(entry => entry.name === 'boostGo')!.t, finale = log.find(entry => entry.name === 'boostFinale')!.t;
  expect(finale - go).toBeLessThan(8000);
  await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 15000 });
  await untilDone(page);
  expect(names(await boostLog(page), 'boostEnd')).toEqual(['boostEnd3']);
  await expect(nextButton(page)).toBeVisible();
  await expect(page.locator('.sp-btop')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a slow pupil with boost power 3 contributes as much as three fast ones', async ({ page }) => {
  test.setTimeout(60000);
  await startController(page, { count: 2, boost: { ...easy, powers: [1, 3] } });
  await recordBoost(page);
  await startBoostRound(page, 2);
  const start = await boostState(page);
  expect(start).toMatchObject({ target: 24, energy: 0 });
  for (let i = 0; i < 4; i++) { await setButtons(page, [2]); await page.waitForTimeout(120); await setButtons(page, []); await page.waitForTimeout(120); }
  expect(await boostState(page)).toMatchObject({ energy: 12, tier: 1 });
  for (let i = 0; i < 4; i++) { await setButtons(page, [3]); await page.waitForTimeout(120); await setButtons(page, []); await page.waitForTimeout(120); }
  expect(await boostPhase(page)).toBe('finale');
  const log = await boostLog(page);
  expect(names(log, 'boostTier', 'boostFinale')).toEqual(['boostTier1', 'boostTier2', 'boostTier3', 'boostFinale3']);
  expect(log.filter(entry => entry.name === 'boostPress' && entry.payload!.player === 0)).toHaveLength(0);
});

test('a switch still held after the boost does not answer the next question until it is released and pressed again', async ({ page }) => {
  test.setTimeout(90000);
  await startController(page, { count: 2, boost: easy });
  await recordBoost(page);
  await startBoostRound(page, 2);
  await mash(page, { mode: 'xac', pupils: [0, 1], ms: 15000, untilNotLive: true });
  await setButtons(page, [0]);
  await untilDone(page);
  await nextButton(page).click();
  await expect(page.locator('.sp-st .sp-pill:visible')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(await countOf(page, 'answerCorrect') + await countOf(page, 'answerTry')).toBe(0);
  await setButtons(page, []);
  await page.waitForTimeout(400);
  await setButtons(page, [0]);
  await expect.poll(async () => await countOf(page, 'answerCorrect') + await countOf(page, 'answerTry')).toBe(1);
});

test('presses before GO are ignored, a switch held through GO does not count, and autorepeat is one press', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page)).toBe('intro');
  await tapKey(page, 0, 0, 80);
  await tapKey(page, 1, 1, 80);
  expect((await boostState(page))?.energy).toBe(0);
  await page.evaluate(code => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'a' })), pupilKeys[1][0]);
  await expect.poll(() => boostPhase(page), { timeout: 8000 }).toBe('live');
  await page.waitForTimeout(500);
  expect((await boostState(page))?.energy).toBe(0);
  await page.evaluate(code => { for (let i = 0; i < 6; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'a', repeat: true })); }, pupilKeys[1][0]);
  await page.waitForTimeout(200);
  expect((await boostState(page))?.energy).toBe(0);
  await page.evaluate(code => window.dispatchEvent(new KeyboardEvent('keyup', { code })), pupilKeys[1][0]);
  await page.waitForTimeout(150);
  await tapKey(page, 1, 0, 80);
  await expect.poll(async () => (await boostState(page))?.energy).toBe(1);
  await page.evaluate(code => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'j' }));
    for (let i = 0; i < 8; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'j', repeat: true }));
  }, pupilKeys[0][1]);
  await page.waitForTimeout(300);
  expect((await boostState(page))?.energy).toBe(2);
});

test('pause freezes the boost timer and ignores presses; resuming carries on', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 12, difficulty: 'normal' } });
  await recordBoost(page);
  await startBoostRound(page, 2);
  await tapKey(page, 0, 0, 80);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const frozen = (await boostState(page))!;
  expect(frozen).toMatchObject({ phase: 'live', paused: true, energy: 1 });
  await page.waitForTimeout(2500);
  await tapKey(page, 1, 0, 80);
  const later = (await boostState(page))!;
  expect(later.phaseTime).toBe(frozen.phaseTime);
  expect(later.energy).toBe(1);
  await page.getByRole('button', { name: 'Resume journey' }).click();
  await page.waitForTimeout(1200);
  const resumed = (await boostState(page))!;
  expect(resumed.paused).toBe(false);
  expect(resumed.phaseTime).toBeGreaterThan(frozen.phaseTime + 900);
  expect(resumed.phaseTime).toBeLessThan(frozen.phaseTime + 2000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await boostState(page))?.paused).toBe(true);
  expect(errors).toEqual([]);
});

test('the teacher can skip the boost from the pause overlay, and the stations come back', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 3, boost: { autoStart: false } });
  await recordBoost(page);
  await passAll(page, 3);
  const before = await page.locator('.sp-st').allTextContents();
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page)).toBe('intro');
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(nextButton(page)).toBeVisible();
  await expect(page.locator('.sp-btop')).toHaveCount(0, { timeout: 4000 });
  expect(names(await boostLog(page), 'boostStart', 'boostGo', 'boostEnd')).toEqual(['boostStart', 'boostEnd1']);
  expect(await page.locator('.sp-st').allTextContents()).toEqual(before);
  for (const card of await page.locator('.sp-st').all()) await expect(card).toHaveCSS('opacity', '1');
  await nextButton(page).click();
  await expect(page.locator('.sp-hub .sp-round')).toHaveText('Round 2 of 6');
  expect(errors).toEqual([]);
});

test('N during the finale skips the rest of the boost and Enter is never a pupil input', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 1, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
  await recordBoost(page);
  await startBoostRound(page, 1);
  await page.keyboard.press('KeyN');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(await boostPhase(page)).toBe('live');
  await mash(page, { mode: 'keys', pupils: [0], ms: 10000, untilNotLive: true });
  expect(await boostPhase(page)).toBe('finale');
  await page.keyboard.press('KeyN');
  await untilDone(page, 4000);
  expect(names(await boostLog(page), 'boostEnd')).toEqual(['boostEnd3']);
  await expect(nextButton(page)).toBeVisible();
});

test('a boost that runs out of time still ends happily at tier 1, then the round carries on', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 8 } });
  await recordBoost(page);
  await startBoostRound(page, 2);
  const live = (await boostState(page))!;
  expect(live.tier).toBe(0);
  await expect.poll(() => boostPhase(page), { timeout: 12000 }).toBe('finale');
  expect(names(await boostLog(page), 'boostTier', 'boostFinale')).toEqual(['boostFinale1']);
  await expect(page.locator('.sp-bbadge')).toHaveText('Boost!', { timeout: 8000 });
  await untilDone(page, 10000);
  await expect(nextButton(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('with boost turned off the round goes straight to the next round', async ({ page }) => {
  await startGame(page, { count: 2 });
  await passAll(page, 2);
  await expect(nextButton(page)).toHaveText(/Next round/);
  await page.waitForTimeout(4600);
  await expect(page.locator('.sp-btop')).toHaveCount(0);
  expect(await boostFlow(page)).toBe('idle');
  await nextButton(page).click();
  await expect(page.locator('.sp-hub .sp-round')).toHaveText('Round 2 of 6');
});

test('with start automatically on, the boost begins by itself after the celebration; off, only the hub button starts it', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 2, boost: { autoStart: true } });
  await recordBoost(page);
  await passAll(page, 2);
  await expect(page.getByRole('button', { name: 'Boost round!' })).toBeVisible();
  await expect(page.locator('.sp-banner-card')).toBeVisible();
  await expect.poll(() => boostFlow(page), { timeout: 8000 }).toBe('running');
  const log = await boostLog(page);
  const ready = log.find(entry => entry.name === 'roundReady')!.t, started = log.find(entry => entry.name === 'boostStart')!.t;
  expect(started - ready).toBeGreaterThan(2400);
  expect(started - ready).toBeLessThan(5000);
  await expect(page.getByRole('button', { name: 'Boost player 2' })).toBeVisible();
});

test('the saucers are native buttons that press through the same counter, by pointer and by keyboard', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 3, boost: { autoStart: false, seconds: 20, difficulty: 'hard' } });
  await startBoostRound(page, 3);
  await expect(page.getByRole('button', { name: /^Boost player \d$/ })).toHaveCount(3);
  const second = page.getByRole('button', { name: 'Boost player 2', exact: true });
  await second.click();
  await expect.poll(async () => (await boostState(page))?.energy).toBe(1);
  await page.waitForTimeout(120);
  await second.click();
  await expect.poll(async () => (await boostState(page))?.energy).toBe(2);
  await second.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await boostState(page))?.energy).toBe(3);
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await boostState(page))?.energy).toBe(4);
});

test('boost with every crew size places one saucer per pupil, evenly spaced', async ({ page }) => {
  for (const count of [1, 2, 3, 4]) {
    await startGame(page, { count, boost: { autoStart: false } });
    await passAll(page, count);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect(page.locator('.sp-bsaucer')).toHaveCount(count);
    await page.waitForTimeout(1200);
    const stage = (await page.locator('.stage').boundingBox())!;
    const centres = (await page.locator('.sp-bsaucer').evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return box.left + box.width / 2; }))).map(x => Math.round(x - stage.x));
    expect(centres).toEqual({ 1: [640], 2: [440, 840], 3: [300, 640, 980], 4: [200, 490, 790, 1080] }[count]);
  }
});

test('after round 6 the boost leads straight to the mission-complete screen', async ({ page }) => {
  test.setTimeout(150000);
  const errors = errorsOf(page);
  await startGame(page, { count: 1, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  await recordBoost(page);
  for (let round = 1; round <= 5; round++) {
    await passAll(page, 1);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Skip boost round' }).click();
    await nextButton(page).click();
  }
  await expect(page.locator('.sp-hub .sp-round')).toHaveText('Round 6 of 6');
  await startBoostRound(page, 1);
  await mash(page, { mode: 'keys', pupils: [0], ms: 10000, untilNotLive: true });
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible({ timeout: 15000 });
  const log = names(await boostLog(page), 'boostStart', 'boostEnd', 'missionComplete');
  expect(log.filter(name => name === 'boostStart')).toHaveLength(6);
  expect(log.at(-2)).toBe('boostEnd3');
  expect(log.at(-1)).toBe('missionComplete');
  expect(errors).toEqual([]);
});

test('Warp Drive reaches the next planet after round 2 exactly once, however the boost went', async ({ page }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 8, difficulty: 'easy' } });
  await recordBoost(page);
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await nextButton(page).click();
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  expect(await countOf(page, 'destinationReached')).toBe(0);
  await expect.poll(() => boostPhase(page), { timeout: 15000 }).toBe('finale');
  await expect.poll(() => countOf(page, 'destinationReached'), { timeout: 8000 }).toBe(1);
  await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
  await untilDone(page, 8000);
  await expect(page.locator('.sp-hub .sp-round')).toHaveText('Round 2 of 6');
  await nextButton(page).click();
  await expect(page.locator('.sp-hub .sp-round')).toHaveText('Round 3 of 6');
  await page.waitForTimeout(500);
  expect(await countOf(page, 'destinationReached')).toBe(1);
  expect(errors).toEqual([]);
});

test('reduced motion: presses, meter and tiers still work, the finale is a calm fade with no particles, and the tier badge and planet appear', async ({ page }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2, reduced: true, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  await recordBoost(page);
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await nextButton(page).click();
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  const spawned = await page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { spawned: number } } } }).__nc.particles.particleStats().spawned);
  await mash(page, { mode: 'keys', pupils: [0, 1], ms: 10000, untilNotLive: true });
  expect(names(await boostLog(page), 'boostTier', 'boostFinale')).toEqual(['boostTier1', 'boostTier2', 'boostTier3', 'boostFinale3']);
  expect(await page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { spawned: number } } } }).__nc.particles.particleStats().spawned)).toBe(spawned);
  await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 10000 });
  await expect(page.locator('.sp-card')).toBeVisible();
  await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
  expect(await page.locator('.sp-bbadge').evaluate(element => getComputedStyle(element).transform)).not.toContain('matrix(0');
  await untilDone(page, 8000);
  expect(errors).toEqual([]);
});

test('a boost never ranks or counts pupils: no digits or names appear on the boost screen', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 3, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
  await startBoostRound(page, 3);
  await mash(page, { mode: 'keys', pupils: [0, 1, 2], ms: 1500 });
  const text = (await page.locator('.sp-btop').innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/\d/);
  expect(text).not.toMatch(/fastest|winner|score|rank|first|second/i);
});

test('tier cards, tier stars, the meter and the saucer heat follow the game state; the ring shows time left', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 3, boost: { autoStart: false, seconds: 20, difficulty: 'easy', powers: [3, 1, 1] } });
  await startBoostRound(page, 3);
  const meterX = (): Promise<number> => page.locator('.sp-meter-fill').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41);
  const heat = (index: number): Promise<number> => page.locator('.sp-bheat').nth(index).evaluate(element => Number(getComputedStyle(element).opacity));
  const tap = async (times: number): Promise<void> => { for (let i = 0; i < times; i++) { await tapKey(page, 0, i % 2, 60); await page.waitForTimeout(90); } };
  expect(Math.round(await meterX())).toBe(-750);
  expect(await heat(0)).toBeCloseTo(0.28, 1);
  await tap(4);
  expect(await boostState(page)).toMatchObject({ tier: 1, energy: 12, target: 36 });
  await expect(page.locator('.sp-bword')).toHaveText('BOOST!');
  await expect(page.locator('.sp-tierstar.is-lit')).toHaveCount(1);
  expect(await heat(0)).toBeGreaterThan(0.6);
  expect(await heat(1)).toBeCloseTo(0.28, 1);
  await tap(4);
  await expect(page.locator('.sp-bword')).toHaveText('SUPER!');
  await expect(page.locator('.sp-tierstar.is-lit')).toHaveCount(2);
  await page.waitForTimeout(400);
  expect(Math.round(await meterX())).toBeGreaterThanOrEqual(-253);
  expect(Math.round(await meterX())).toBeLessThanOrEqual(-247);
  const ring = await page.locator('.sp-timer-arc').getAttribute('stroke-dasharray');
  const [drawn, whole] = ring!.split(' ').map(Number);
  expect(drawn / whole).toBeGreaterThan(0.6);
  expect(drawn / whole).toBeLessThan(1);
  await tap(4);
  await expect(page.locator('.sp-bword')).toHaveText('MEGA!');
  await expect(page.locator('.sp-tierstar.is-lit')).toHaveCount(3);
  expect(await boostPhase(page)).toBe('finale');
  expect(errors).toEqual([]);
});

test('a pupil who has not pressed for 4 seconds gets a sparkle and a wiggle, and nothing else', async ({ page }) => {
  test.setTimeout(60000);
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 20, difficulty: 'hard' } });
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { ready: boolean } } } }).__nc.particles.particleStats().ready)).toBe(true);
  await startBoostRound(page, 2);
  const spawned = (): Promise<number> => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { spawned: number } } } }).__nc.particles.particleStats().spawned);
  const live = await spawned();
  await page.waitForTimeout(3000);
  const before = await spawned();
  expect(before - live).toBe(0);
  await page.waitForTimeout(1500);
  expect(await spawned() - before).toBeGreaterThanOrEqual(12);
  expect(await page.locator('.sp-btop').innerText()).not.toMatch(/press|faster|hurry|idle/i);
  await tapKey(page, 0, 0, 60);
  expect((await boostState(page))?.energy).toBe(1);
});

test('an assigned controller that disconnects mid-boost pauses it and freezes its timer; after recovery the boost starts again from its intro', async ({ page }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await startController(page, { count: 2, boost: { ...easy, seconds: 20 } });
  await recordBoost(page);
  await startBoostRound(page, 2);
  await setButtons(page, [0]); await page.waitForTimeout(120); await setButtons(page, []);
  await page.waitForTimeout(800);
  await setConnected(page, false);
  await expect(page.getByRole('dialog')).toContainText('disconnected');
  const frozen = (await boostState(page))!;
  expect(frozen).toMatchObject({ phase: 'live', paused: true });
  await page.waitForTimeout(2000);
  expect((await boostState(page))!.phaseTime).toBe(frozen.phaseTime);
  await setConnected(page, true);
  await page.getByRole('button', { name: 'Reconnect & check switches' }).click();
  await mapAndCheck(page, 2);
  await page.getByRole('button', { name: 'Resume journey' }).click();
  await expect(page.locator('.sp-st')).toHaveCount(2);
  expect(await boostFlow(page)).toBe('waiting');
  expect(await boostState(page)).toBeNull();
  await expect(page.locator('.sp-btop')).toHaveCount(0);
  for (const card of await page.locator('.sp-st').all()) await expect(card).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostState(page)).toMatchObject({ phase: 'intro', energy: 0 });
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  expect(errors).toEqual([]);
});

test('enlarged turns: the boost still has one saucer per pupil, and the single station comes back afterwards', async ({ page }) => {
  test.setTimeout(60000);
  const errors = errorsOf(page);
  await startGame(page, { count: 3, enlarged: true, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  for (let turn = 1; turn <= 3; turn++) {
    await page.getByRole('button', { name: `Pass player ${turn}`, exact: true }).click();
    if (turn < 3) await page.getByRole('button', { name: 'Next player' }).click();
  }
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect(page.locator('.sp-bsaucer')).toHaveCount(3);
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await mash(page, { mode: 'keys', pupils: [0, 1, 2], ms: 15000, untilNotLive: true });
  await expect.poll(() => boostFlow(page), { timeout: 15000 }).toBe('done');
  await expect(nextButton(page)).toHaveText(/Next round/);
  await expect(page.locator('.sp-st')).toHaveCount(1);
  await expect(page.locator('.sp-st').first()).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});
