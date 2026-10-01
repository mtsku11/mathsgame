import { test, expect, type Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { mkdirSync } from 'node:fs';

const shots = 'test-results/redesign/phase0';
const sizes = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1366, height: 768 }];

function pixel(png: Buffer): number[] {
  const channels = png[25] === 6 ? 4 : 3;
  const data: Buffer[] = [];
  for (let offset = 8; offset < png.length; offset += 12 + png.readUInt32BE(offset)) {
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + png.readUInt32BE(offset)));
  }
  return [...inflateSync(Buffer.concat(data)).subarray(1, 1 + channels)];
}
const pixelAt = async (page: Page, x: number, y: number) => pixel(await page.screenshot({ clip: { x, y, width: 1, height: 1 } }));
const ready = (page: Page) => page.evaluate(() => document.fonts.ready.then(() => true));
const hasWebGL = (page: Page) => page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));

test('title is the first screen with one Start button and no console errors', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Same origin as the game, so the check holds on the dev server and on the hosted site.
  const origin = new URL(test.info().project.use.baseURL!).origin;
  page.on('request', request => { if (!request.url().startsWith('data:') && new URL(request.url()).origin !== origin) external.push(request.url()); });
  await page.goto('./');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Number Crew', level: 1 })).toBeVisible();
  await expect(page.getByText('Star Pilots', { exact: true })).toBeVisible();
  await expect(page.locator('.sp-tpilot')).toHaveCount(4);
  const button = page.getByRole('button', { name: 'Start', exact: true });
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(button).toBeFocused();
  await expect(page.getByLabel('Crew size')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await button.click();
  await expect(page.getByLabel('Crew size')).toBeVisible();
  await expect(page.locator('.stage-viewport')).toHaveCount(0);
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const { width, height } of sizes) {
  test(`stage stays 16:9, centred and inside the window at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./?instant');
    await ready(page);
    const box = (await page.locator('.stage').boundingBox())!;
    const scale = Math.min(width / 1280, height / 720);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
    expect(box.width).toBeCloseTo(1280 * scale, 0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.01);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 0.01);
    expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y - (height - box.height) / 2)).toBeLessThanOrEqual(1);
    expect(await page.locator('.stage').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)).toBeCloseTo(scale, 4);
    const button = (await page.getByRole('button', { name: 'Start' }).boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(box.x);
    expect(button.y + button.height).toBeLessThanOrEqual(box.y + box.height);
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/title-${width}x${height}.png` });
  });
}

test('stage letterboxes on the deep-space background and recomputes on resize', async ({ page }) => {
  await page.goto('./?instant');
  await page.setViewportSize({ width: 800, height: 600 });
  await expect.poll(async () => Math.round((await page.locator('.stage').boundingBox())!.width)).toBe(800);
  const box = (await page.locator('.stage').boundingBox())!;
  expect(Math.round(box.height)).toBe(450);
  expect(Math.round(box.y)).toBe(75);
  expect(await pixelAt(page, 400, 20)).toEqual([8, 5, 31]);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(async () => Math.round((await page.locator('.stage').boundingBox())!.width)).toBe(600);
});

test('idle bob runs by default, and stops in reduced motion and instant mode', async ({ page }) => {
  const transform = (p: Page) => p.locator('.sp-tpilot').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
  await page.goto('./');
  await expect.poll(async () => (await transform(page)).some(value => value !== 'none')).toBe(true);
  await page.goto('./?instant');
  await page.waitForTimeout(400);
  expect((await transform(page)).every(value => value === 'none')).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('html')).toHaveClass(/nc-reduced/);
  await page.waitForTimeout(400);
  expect((await transform(page)).every(value => value === 'none')).toBe(true);
  expect(await page.locator('.sp-tw').first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});

test('effects layer is skipped in instant mode unless ?fx is present', async ({ page }) => {
  await page.goto('./?instant');
  await page.waitForTimeout(500);
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
});

test('effects canvas is a transparent, click-through 1280x720 layer above the stage', async ({ page }) => {
  await page.goto('./?instant&fx');
  test.skip(!await hasWebGL(page), 'WebGL is unavailable in this browser');
  await ready(page);
  const canvas = page.locator('.stage > .fx-canvas');
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate(element => ({ css: [getComputedStyle(element).width, getComputedStyle(element).height], events: getComputedStyle(element).pointerEvents,
    last: element === element.parentElement!.lastElementChild, quality: (element as HTMLElement).dataset.quality, size: [(element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height] })))
    .toEqual({ css: ['1280px', '720px'], events: 'none', last: true, quality: 'high', size: [2560, 1440] });
  const points = [[5, 5], [640, 360], [1275, 715], [300, 600], [1000, 120]];
  const withFx = await Promise.all(points.map(([x, y]) => pixelAt(page, x, y)));
  await page.goto('./?instant');
  await ready(page);
  const without = await Promise.all(points.map(([x, y]) => pixelAt(page, x, y)));
  expect(withFx).toEqual(without);
  expect(withFx.every(rgb => rgb.some(channel => channel > 0))).toBe(true);
});

test('missing WebGL is logged once and the title still works', async ({ page }) => {
  const errors: string[] = [], warnings: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('./?instant&fx');
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
  expect(warnings.filter(text => text.includes('Effects layer unavailable'))).toHaveLength(1);
  expect(errors).toEqual([]);
});
