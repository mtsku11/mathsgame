import { test, expect } from '@playwright/test';
import { openSetup, enterSetup } from '../helpers';

test('published game reloads offline and completes all six rounds', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.scope)).toBe(new URL('./', page.url()).href);
  await context.setOffline(true);
  await page.reload();
  await enterSetup(page);
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
  expect(errors).toEqual([]);
});
