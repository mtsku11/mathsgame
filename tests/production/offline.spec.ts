import { test, expect } from '@playwright/test';
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
  await page.goto(origin);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByLabel('Crew size').selectOption('4');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);
  for (let round = 1; round <= 6; round++) {
    for (let pupil = 0; pupil < 4; pupil++) {
      const station = page.locator('.station').nth(pupil);
      const total = await station.locator('.question-area .dot').count();
      const values = await station.locator('.answer-value').allTextContents();
      await station.locator('.answer').nth(values.findIndex(value => Number(value) === total)).click();
      await expect(station.locator('.station-footer > p')).toContainText('Cargo ready');
    }
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
    if (round < 6) await page.waitForTimeout(550);
  }
  await expect(page.locator('.result-stars')).toContainText('24 crew stars collected');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Another adventure' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);
  updated = true;
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect(page.locator('#offline-status')).toHaveText('Update ready between journeys');
  await expect(page.getByRole('button', { name: 'Update game now' })).toHaveCount(0);
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting)).toBe(true);
  for (let round = 1; round <= 6; round++) {
    for (let pupil = 1; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
  }
  await page.getByRole('button', { name: 'Update game now' }).click();
  await expect(page.getByLabel('Crew size')).toBeVisible();
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting === null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(errors).toEqual([]);
});
