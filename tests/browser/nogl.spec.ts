import { test, expect } from '@playwright/test';
import { boostFlow, boostPhase, correctSide, mash, nextButton, passAll, startGame, station, tapKey } from '../helpers';

test.use({ launchOptions: { args: ['--disable-gpu', '--disable-3d-apis', '--disable-webgl', '--disable-webgl2'] } });

test('without WebGL the effects layer degrades silently and the game still plays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await startGame(page, { count: 2 });
  await page.waitForTimeout(600);
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
  const stats = () => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): unknown } } }).__nc.particles.particleStats());
  expect(await stats()).toMatchObject({ ready: false, alive: 0 });
  await page.evaluate(() => (window as unknown as { __nc: { particles: { burst(x: number, y: number, o: object): void } } }).__nc.particles.burst(640, 360, { count: 20 }));
  expect(await stats()).toMatchObject({ spawned: 0 });
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await expect(page.locator('.sp-core-num')).toHaveText('1');
  await tapKey(page, 1, 0);
  await expect(station(page, 1).locator('.sp-pill')).toBeVisible();
  expect(errors).toEqual([]);
});

test('without WebGL a Warp Drive boost still plays to MAX and arrives, with the tunnel as a calm fade', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await startGame(page, { count: 2, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await nextButton(page).click();
  await passAll(page, 2);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await mash(page, { mode: 'keys', pupils: [0, 1], ms: 10000, untilNotLive: true });
  await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 10000 });
  await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
  await expect.poll(() => boostFlow(page), { timeout: 10000 }).toBe('done');
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
  await expect(nextButton(page)).toBeVisible();
  expect(errors).toEqual([]);
});
