import { test, expect } from '@playwright/test';
import { correctSide, startGame, station, tapKey } from '../helpers';

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
