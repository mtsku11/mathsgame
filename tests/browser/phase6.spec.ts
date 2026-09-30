import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { boostPhase, mash, nc, nextButton, openSetup, passAll, setBoost, skipToRound, startGame, station } from '../helpers';

const shots = 'test-results/redesign/phase6';
mkdirSync(shots, { recursive: true });
const sizes = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }] as const;
const silent = './?silentaudio';

const serious = async (page: Page): Promise<string[]> => (await new AxeBuilder({ page }).analyze()).violations
  .filter(violation => violation.impact === 'serious' || violation.impact === 'critical').map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`);
const voicePlays = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { log: { channel: string; action: string; id: string }[] } }).__NC_AUDIO__.log
  .filter(entry => entry.channel === 'voice' && entry.action === 'play').map(entry => entry.id));
const clearLog = (page: Page): Promise<void> => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { clear(): void } }).__NC_AUDIO__.clear());
const visibleOutline = (target: Locator): Promise<boolean> => target.evaluate(element => {
  const style = getComputedStyle(element);
  return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
});
async function finishMission(page: Page, count: number): Promise<void> {
  for (let round = 1; round <= 6; round++) { await passAll(page, count); await nextButton(page).click(); }
  await expect(page.locator('.sp-fin-title')).toBeVisible();
}

for (const count of [3, 4]) {
  test(`spotlight screenshots with ${count} pupils`, async ({ page }) => {
    for (const size of sizes) {
      await page.setViewportSize(size);
      await startGame(page, { count, enlarged: true, presets: ['add10', 'add10', 'add10', 'add10'].slice(0, count) });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${shots}/spotlight-${count}p-${size.width}x${size.height}.png` });
    }
  });
}

test('spotlight: the active pupil fills the stage, the others rest with no answer buttons, and the turn moves on the teacher\'s Next', async ({ page }) => {
  await startGame(page, { count: 4, enlarged: true, url: silent });
  await expect(page.locator('.sp-st')).toHaveCount(1);
  await expect(page.locator('.sp-rest')).toHaveCount(3);
  await expect(page.locator('.sp-rests button, .sp-rests [data-answer-side]')).toHaveCount(0);
  await expect(page.locator('.sp-st .sp-btn')).toHaveCount(2);
  const size = await station(page, 0).boundingBox();
  expect(size!.width).toBeGreaterThan(780);
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(station(page, 0)).toHaveAttribute('aria-label', 'Player 2');
  await expect(page.locator('.sp-rest')).toHaveCount(3);
  await expect(page.locator('.sp-rest').first()).toHaveAttribute('aria-label', 'Player 1, finished');
});

test('spotlight: the narrator reads the active pupil\'s question when each turn starts', async ({ page }) => {
  await startGame(page, { count: 2, enlarged: true, url: silent });
  await expect.poll(() => voicePlays(page), { timeout: 10000 }).toContain('how_many');
  await clearLog(page);
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect.poll(() => voicePlays(page), { timeout: 10000 }).toContain('how_many');
});

test('spotlight: automatic narration follows narration and low stimulation, but a teacher\'s Say it still works', async ({ page }) => {
  await openSetup(page, silent);
  await page.getByLabel('Crew size').selectOption('2');
  await setBoost(page, false);
  await page.getByLabel('Screen layout').selectOption('enlarged');
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Low stimulation').check();
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(page.locator('.sp-st').first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await voicePlays(page)).not.toContain('how_many');
  await page.getByRole('button', { name: 'Say Pink\'s question' }).click();
  await expect.poll(() => voicePlays(page)).toContain('how_many');
});

test('the Graphics setting chooses the quality level and low power flags the page', async ({ page }) => {
  await startGame(page, { count: 2, quality: 'low' });
  await expect(page.locator('html')).toHaveClass(/nc-lowpower/);
  await expect(page.locator('.fx-canvas')).toHaveAttribute('data-quality', 'low');
  expect(await nc(page, ({ particles }) => particles.particleStats().cap)).toBe(600);
  await page.reload();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Graphics')).toHaveValue('low');
  await page.getByLabel('Graphics').selectOption('high');
  await expect(page.locator('html')).not.toHaveClass(/nc-lowpower/);
});

test('the startup benchmark maps timings to a quality level', async ({ page }) => {
  await page.goto('./');
  const levels = await nc(page, ({ pixi }) => [{ workMs: 5, frameMs: 16.7 }, { workMs: 130, frameMs: 16.7 }, { workMs: 10, frameMs: 22 }, { workMs: 200, frameMs: 16.7 }, { workMs: 10, frameMs: 40 }].map(sample => pixi.pickLevel(sample)));
  expect(levels).toEqual(['high', 'medium', 'medium', 'low', 'low']);
});

for (const count of [1, 2, 3, 4]) for (const enlarged of [false, true]) {
  test(`axe: play with ${count} pupil${count === 1 ? '' : 's'}${enlarged ? ' in Spotlight' : ''}, plus teacher focus`, async ({ page }) => {
    await startGame(page, { count, enlarged, presets: ['add10', 'add10', 'add10', 'add10'].slice(0, count) });
    await page.waitForTimeout(700);
    expect(await serious(page)).toEqual([]);
    // One Tab establishes keyboard modality; tabbing past the last control would leave the page, which pauses the game.
    await page.getByRole('button', { name: 'Pause game', exact: true }).focus();
    await page.keyboard.press('Tab');
    for (const name of ['Pause game', 'Say Pink\'s question', 'Help player 1', 'Pass player 1']) {
      const control = page.getByRole('button', { name, exact: true });
      await control.focus();
      expect(await visibleOutline(control), name).toBe(true);
    }
    if (enlarged) await page.getByRole('button', { name: 'Pass player 1', exact: true }).click(); else await passAll(page, count);
    const next = nextButton(page);
    await page.keyboard.press('Shift');
    await next.focus();
    expect(await visibleOutline(next), 'Next').toBe(true);
    await expect(page.locator('[aria-live]')).toHaveCount(1);
  });
}

test('axe and focus: crew check-in', async ({ page }) => {
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption('3');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.locator('.ck-card')).toHaveCount(3);
  await page.waitForTimeout(600);
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press('Shift');
  for (const name of ['Start anyway', 'Back to setup']) {
    const control = page.getByRole('button', { name, exact: true });
    await control.focus();
    expect(await visibleOutline(control), name).toBe(true);
  }
});

test('axe: boost live HUD, and only tier changes are announced while pupils mash', async ({ page }) => {
  test.setTimeout(90000);
  await startGame(page, { count: 4, boost: { autoStart: false, seconds: 20, difficulty: 'hard' } });
  await passAll(page, 4);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 15000 }).toBe('live');
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __status: string[] }).__status = log;
    new MutationObserver(() => log.push(document.querySelector('#game-status')!.textContent ?? '')).observe(document.querySelector('#game-status')!, { childList: true, characterData: true, subtree: true });
  });
  expect(await serious(page)).toEqual([]);
  await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 4000 });
  const messages = await page.evaluate(() => (window as unknown as { __status: string[] }).__status);
  expect(messages.length).toBeLessThanOrEqual(4);
  for (const message of messages) expect(message).toMatch(/BOOST|SUPER|MEGA|Boost|Super|Mega|Well done|Go!/i);
  await expect(page.locator('[aria-live]')).toHaveCount(1);
});

test('axe and focus: finale, and the open teacher summary never covers a pilot or a button', async ({ page }) => {
  test.setTimeout(90000);
  for (const size of sizes) {
    for (const count of [1, 2, 4]) {
      await page.setViewportSize(size);
      await startGame(page, { count });
      await finishMission(page, count);
      await page.waitForTimeout(2400);
      expect(await serious(page)).toEqual([]);
      await page.keyboard.press('Shift');
      for (const name of ['Another adventure', 'New session']) {
        const control = page.getByRole('button', { name: new RegExp(name) });
        await control.focus();
        expect(await visibleOutline(control), name).toBe(true);
      }
      await page.locator('.sp-fin-summary summary').click();
      await page.waitForTimeout(300);
      if (count === 4 || count === 1) await page.screenshot({ path: `${shots}/finale-summary-${count}p-${size.width}x${size.height}.png` });
      const box = await page.locator('.sp-fin-summary').boundingBox();
      const overlaps = await page.evaluate(rect => {
        const hit = (element: Element): boolean => { const b = element.getBoundingClientRect(); return !(b.right <= rect!.x || b.left >= rect!.x + rect!.width || b.bottom <= rect!.y || b.top >= rect!.y + rect!.height); };
        return [...document.querySelectorAll('.sp-fin-pilot svg, .sp-fin-actions button')].filter(hit).length;
      }, box);
      expect(overlaps, `${count} pupils at ${size.width}x${size.height}`).toBe(0);
      expect(await serious(page), 'summary open').toEqual([]);
      await page.goto('./');
    }
  }
});

test('switch-cap colours: the answer buttons, check-in caps and switch slots follow the teacher\'s choice', async ({ page }) => {
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption('2');
  await setBoost(page, false);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Player 1 left switch colour').selectOption('red');
  await page.getByLabel('Player 1 right switch colour').selectOption('yellow');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  const cap = (side: number) => page.locator('.ck-card').first().locator('.ck-cap').nth(side);
  await expect(cap(0)).toHaveClass(/has-cap/);
  expect(await cap(0).evaluate(el => el.style.getPropertyValue('--cap'))).toBe('#C62828');
  expect(await cap(1).evaluate(el => el.style.getPropertyValue('--cap'))).toBe('#FFD23F');
  await expect(page.locator('.ck-card').nth(1).locator('.ck-cap').first()).not.toHaveClass(/has-cap/);
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(station(page, 0).locator('.sp-btn').first()).toHaveClass(/has-cap/);
  expect(await station(page, 0).locator('.sp-btn').nth(1).evaluate(el => [el.style.getPropertyValue('--cap'), getComputedStyle(el).color])).toEqual(['#FFD23F', 'rgb(26, 20, 70)']);
  await expect(station(page, 1).locator('.sp-btn').first()).not.toHaveClass(/has-cap/);
  expect(await serious(page)).toEqual([]);
  await page.screenshot({ path: `${shots}/caps-2p-play.png` });
});

for (const count of [1, 2]) for (const size of sizes) {
  test(`${count} player polish screenshots at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(size);
    await startGame(page, { count, presets: ['add10', 'add10'].slice(0, count), boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shots}/${count}p-play-${size.width}x${size.height}.png` });
    await passAll(page, count);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect.poll(() => boostPhase(page), { timeout: 15000 }).toBe('live');
    await mash(page, { mode: 'keys', pupils: [0, 1].slice(0, count), ms: 2500 });
    await page.screenshot({ path: `${shots}/${count}p-boost-${size.width}x${size.height}.png` });
  });
}

test('switch-cap colour screenshots for check-in and switch setup', async ({ page }) => {
  await page.setViewportSize(sizes[0]);
  await skipToRound;
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption('4');
  await setBoost(page, false);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  const colours = ['red', 'yellow', 'blue', 'green', 'purple', 'orange', 'white', 'black'];
  for (let player = 0; player < 4; player++) for (const side of [0, 1]) await page.getByLabel(`Player ${player + 1} ${side ? 'right' : 'left'} switch colour`).selectOption(colours[player * 2 + side]);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}/caps-checkin-4p-1280x720.png` });
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/caps-4p-play-1280x720.png` });
});

test('the startup benchmark runs once on load and settles what Auto means', async ({ page }) => {
  await page.goto('./');
  await expect.poll(() => nc(page, ({ pixi }) => pixi.lastBenchmark !== null), { timeout: 10000 }).toBe(true);
  const result = await nc(page, ({ pixi }) => pixi.lastBenchmark!);
  console.log(`BENCH ${JSON.stringify(result)}`);
  expect(['high', 'medium', 'low']).toContain(result.level);
});
