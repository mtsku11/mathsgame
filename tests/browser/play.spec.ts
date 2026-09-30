import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { answerCorrectly, correctSide, nextButton, passAll, startGame, station, wrongSide } from '../helpers';

const shots = 'test-results/redesign/phase1';
const sizes = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];
const mixed = ['count', 'add5', 'count', 'add10'];
const fontsReady = (page: Page) => page.evaluate(() => document.fonts.load('64px "Titan One"').then(() => document.fonts.load('700 30px "Baloo 2"')).then(() => document.fonts.ready));
const tracked = '.stage, .sp-play, .sp-hud, .sp-hub, .sp-st, .sp-bob, .sp-objs, .sp-btn, .sp-ghost, .sp-next';

test('stations and answer buttons are the same instances through answers, help, pass, pause and a new round; no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await startGame(page);
  const total = await page.evaluate(selector => {
    const elements = [...document.querySelectorAll(selector)];
    elements.forEach((element, index) => { (element as any).__tag = index; });
    return elements.length;
  }, tracked);
  expect(total).toBeGreaterThan(30);
  const expectStable = async (step: string) => {
    const tags = await page.evaluate(selector => [...document.querySelectorAll(selector)].map(element => (element as any).__tag), tracked);
    expect(tags, step).toEqual(Array.from({ length: total }, (_, index) => index));
  };
  await expectStable('start');
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await wrongSide(first)).click();
  await expect(first.locator('.sp-pill')).toHaveText('Try again');
  await expectStable('wrong try');
  await page.waitForTimeout(600);
  await answerCorrectly(page, 1);
  await expectStable('correct answer');
  await page.getByRole('button', { name: 'Help player 3', exact: true }).click();
  await page.getByRole('button', { name: 'Pass player 4', exact: true }).click();
  await expectStable('help and pass');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.sp-play')).toHaveJSProperty('inert', true);
  await expect(page.locator('.sp-btn:disabled')).toHaveCount(8);
  await expectStable('paused');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.locator('.sp-play')).toHaveJSProperty('inert', false);
  await expectStable('resumed');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expectStable('blur pause');
  await page.waitForTimeout(600);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await page.getByRole('button', { name: 'Pass player 3', exact: true }).click();
  await nextButton(page).click();
  await expectStable('new round');
  await expect(page.locator('.sp-st.is-live')).toHaveCount(4);
  await expect(page.locator('.sp-pill:not([hidden])')).toHaveCount(0);
  await expect(page.locator('.sp-btn.is-ready')).toHaveCount(8);
  await expect(page.locator('.sp-st.is-helped')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a switch press shows the pressed state briefly on the right button', async ({ page }) => {
  await startGame(page, { count: 2 });
  await page.evaluate(() => {
    (window as any).pressed = [];
    new MutationObserver(records => records.forEach(record => {
      const target = record.target as HTMLElement;
      if (target.classList.contains('is-pressed')) (window as any).pressed.push(target.getAttribute('aria-label'));
    })).observe(document.querySelector('.stage')!, { attributes: true, attributeFilter: ['class'], subtree: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ' }));
  });
  await expect.poll(() => page.evaluate(() => (window as any).pressed as string[])).toContainEqual(expect.stringMatching(/^Player 1, right answer, \d+$/));
  await expect(page.locator('.sp-btn.is-pressed')).toHaveCount(0);
});

test('idle motion runs by default and stops in instant mode and low stimulation', async ({ page }) => {
  await startGame(page);
  const transforms = () => page.locator('.sp-bob').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
  await expect.poll(async () => (await transforms()).some(value => value !== 'none')).toBe(true);
  const names = () => page.evaluate(() => ({
    ring: getComputedStyle(document.querySelector('.sp-btn.is-ready')!, '::after').animationName,
    sky: getComputedStyle(document.querySelector('.sp-tw')!).animationName,
    beam: getComputedStyle(document.querySelector('.sp-beam')!).animationName,
    ship: getComputedStyle(document.querySelector('.sp-ship')!).animationName,
  }));
  expect(await names()).toEqual({ ring: 'sp-ring', sky: 'sp-twinkle', beam: 'sp-flow', ship: 'sp-float' });
  await page.evaluate("(async () => (await import('/src/ui/fx/motion.ts')).setLowStim(true))()");
  expect(await names()).toEqual({ ring: 'none', sky: 'none', beam: 'none', ship: 'none' });

  await startGame(page, { url: './?instant' });
  await page.waitForTimeout(400);
  expect((await transforms()).every(value => value === 'none')).toBe(true);
  expect(await names()).toEqual({ ring: 'none', sky: 'none', beam: 'none', ship: 'none' });
});

test('destination art follows the round: two rounds each at Golden Rings, Candy Planet and Frosty Moon', async ({ page }) => {
  await startGame(page, { count: 3, url: './?instant' });
  await expect(page.locator('.sp-big-name')).toHaveText('Golden Rings');
  await expect(page.locator('.sp-dest')).toHaveCSS('visibility', 'hidden');
  const names = ['Golden Rings', 'Golden Rings', 'Candy Planet', 'Candy Planet', 'Frosty Moon', 'Frosty Moon'];
  for (const [index, name] of names.entries()) {
    await expect(page.locator('.sp-big-name')).toHaveText(name);
    await expect(page.getByRole('region', { name: 'Journey progress' })).toContainText(`Round ${index + 1} of 6`);
    await passAll(page, 3);
    if (index < 5) await nextButton(page).click();
  }
});

for (const { width, height } of sizes) {
  test(`play screenshots for 1-4 pupils at ${width}x${height}`, async ({ page }) => {
    mkdirSync(shots, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const count of [1, 2, 3, 4]) {
      await startGame(page, { count, presets: mixed.slice(0, count), url: './?instant' });
      await fontsReady(page);
      await expect(page.locator('.sp-st')).toHaveCount(count);
      await page.screenshot({ path: `${shots}/${count}p-${width}x${height}.png` });
    }
    expect(errors).toEqual([]);
  });

  test(`four-player state gallery and pause overlay at ${width}x${height}`, async ({ page }) => {
    mkdirSync(shots, { recursive: true });
    await page.setViewportSize({ width, height });
    await startGame(page, { presets: mixed, url: './?instant' });
    await fontsReady(page);
    await answerCorrectly(page, 0);
    await page.getByRole('button', { name: 'Help player 3', exact: true }).click();
    const third = station(page, 2);
    await third.locator('.sp-btn').nth(await wrongSide(third)).click();
    await page.getByRole('button', { name: 'Pass player 4', exact: true }).click();
    await expect(third.locator('.sp-pill')).toHaveText('Count with me');
    await expect(station(page, 1).locator('.sp-btn.is-ready')).toHaveCount(2);
    await expect(nextButton(page)).toBeHidden();
    await page.screenshot({ path: `${shots}/4p-states-${width}x${height}.png` });

    await page.getByRole('button', { name: 'Pause game' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `${shots}/pause-${width}x${height}.png` });
    await page.getByRole('button', { name: 'Resume journey', exact: true }).click();

    await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
    await page.getByRole('button', { name: 'Pass player 3', exact: true }).click();
    const next = nextButton(page, 'Next round');
    await expect(next).toBeVisible();
    const [hub, button] = await Promise.all([page.locator('.sp-hub').boundingBox(), next.boundingBox()]);
    expect(button!.x).toBeGreaterThanOrEqual(hub!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(hub!.x + hub!.width + 0.5);
    expect(button!.y + button!.height).toBeLessThanOrEqual(hub!.y + hub!.height);
    await page.screenshot({ path: `${shots}/4p-next-${width}x${height}.png` });
  });
}
