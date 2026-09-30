import { test, expect } from '@playwright/test';
import { enterSetup, answerCorrectly, correctSide, nextButton, setBoost, station, tapKey } from '../helpers';

test('published game reloads offline and completes the mission from title to finale', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Number Crew', level: 1 })).toBeVisible();
  await enterSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.scope)).toBe(new URL('./', page.url()).href);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Number Crew', level: 1 })).toBeVisible();
  await enterSetup(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByLabel('Crew size').selectOption('4');
  await setBoost(page, false);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.getByRole('heading', { name: 'Crew check!' })).toBeVisible();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(station(page, 0)).toBeVisible();
  await page.waitForTimeout(150);
  for (let round = 1; round <= 6; round++) {
    for (let pupil = 0; pupil < 4; pupil++) {
      // Round 1 uses the pupils' keyboard keys; later rounds use the on-screen buttons.
      if (round === 1) {
        await tapKey(page, pupil, await correctSide(station(page, pupil)));
        await expect(station(page, pupil).locator('.sp-pill')).toHaveText('Star sent!');
      } else await answerCorrectly(page, pupil);
    }
    await nextButton(page, round === 6 ? 'Finish journey' : 'Next round').click();
    if (round < 6) await page.waitForTimeout(550);
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await expect(page.locator('.sp-fin-stars')).toContainText('24 crew stars collected');
  expect(errors).toEqual([]);
});
