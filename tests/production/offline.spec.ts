import { test, expect } from '@playwright/test';
import { openSetup, enterSetup, answerCorrectly, mash, nextButton, passAll, setBoost } from '../helpers';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

let server: Server;
let origin: string;
let updated = false;

test.beforeAll(async () => {
  const root = resolve('dist');
  server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${root}/`)) { response.writeHead(403).end(); return; }
    try {
      let content = await readFile(file);
      // A second worker version exercises the real waiting/activation flow without changing the build on disk.
      if (updated && path === '/sw.js') content = Buffer.from(content.toString().replace(/number-crew-([a-f0-9]+)/, 'number-crew-$1-update-test'));
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); });

test('production reloads offline, completes a mission, and defers updates until the finale', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openSetup(page, origin);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  await context.setOffline(true);
  await page.reload();
  await enterSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByLabel('Crew size').selectOption('4');
  await setBoost(page, false);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);
  for (let round = 1; round <= 6; round++) {
    for (let pupil = 0; pupil < 4; pupil++) {
      await answerCorrectly(page, pupil);
    }
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
    if (round < 6) await page.waitForTimeout(550);
  }
  await expect(page.locator('.sp-fin-stars')).toContainText('24 crew stars collected');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Another adventure' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);
  updated = true;
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting)).toBe(true);
  await expect(page.getByRole('button', { name: 'Update game now' })).toHaveCount(0);
  for (let round = 1; round <= 6; round++) {
    for (let pupil = 1; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
  }
  await expect(page.locator('#offline-status')).toHaveText('Update ready between journeys');
  await page.getByRole('button', { name: 'Update game now' }).click();
  await expect(page.getByRole('heading', { name: 'Number Crew', level: 1 })).toBeVisible();
  await enterSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting === null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await enterSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(errors).toEqual([]);
});

test('production plays a Warp Drive boost round offline, including the lazily loaded effects chunks', async ({ page, context }) => {
  test.setTimeout(90000);
  const errors: string[] = [], failed: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failed.push(request.url()));
  await openSetup(page, origin);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  await context.setOffline(true);
  await page.reload();
  await enterSetup(page);
  await page.getByLabel('Crew size').selectOption('4');
  await setBoost(page, { autoStart: false, seconds: 20, difficulty: 'easy' });
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await passAll(page, 4);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await nextButton(page).click();
  await passAll(page, 4);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await page.waitForTimeout(5000);
  await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 6000 });
  await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 15000 });
  await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
  await expect(nextButton(page)).toBeVisible({ timeout: 10000 });
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test('production plays a Firework Frenzy and a Bubble Blast boost offline, with every scene asset already cached', async ({ page, context }) => {
  test.setTimeout(150000);
  const errors: string[] = [], failed: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failed.push(request.url()));
  await openSetup(page, origin);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  await context.setOffline(true);
  await page.reload();
  await enterSetup(page);
  await page.getByLabel('Crew size').selectOption('2');
  await setBoost(page, { autoStart: false, seconds: 12, difficulty: 'easy' });
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  const play = async (scene: string): Promise<void> => {
    await passAll(page, 2);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect(page.locator(`[data-boost-scene="${scene}"]`)).toHaveCount(1);
    await page.waitForTimeout(5000);
    await mash(page, { mode: 'keys', pupils: [0, 1], ms: 7000 });
    await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 15000 });
    await expect(nextButton(page)).toBeVisible({ timeout: 10000 });
    await nextButton(page).click();
  };
  await play('fireworkFrenzy');
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await nextButton(page).click();
  await play('bubbleBlast');
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
