import { test, expect } from '@playwright/test';

for (const count of [3, 4]) {
  for (const enlarged of [false, true]) {
    test(`${count} pupils ${enlarged ? 'enlarged' : 'simultaneous'} retain controls and large targets at 720p`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('./');
      await page.getByLabel('Crew size').selectOption(String(count));
      await page.getByLabel('Screen layout').selectOption(enlarged ? 'enlarged' : 'together');
      for (let i = 1; i <= count; i++) await page.getByLabel(`Player ${i} maths`).selectOption('add10');
      await page.getByText('Comfort & access settings', { exact: true }).click();
      for (const checkbox of await page.getByLabel('Picture answers for addition').all()) await checkbox.check();
      await page.getByLabel('Keyboard & on-screen buttons').check();
      await page.getByRole('button', { name: 'Enter practice' }).click();
      const fits = async () => {
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const targets = await page.locator('.answer').evaluateAll(elements => elements.map(element => {
          const box = element.getBoundingClientRect(); return box.width >= 96 && box.height >= 96;
        }));
        expect(targets.every(Boolean)).toBe(true);
      };
      await fits();
      await page.getByRole('button', { name: 'Launch the journey' }).click();
      await fits();
      const before = await page.locator('.answer').first().boundingBox();
      for (let i = 1; i <= (enlarged ? 1 : count); i++) await page.getByRole('button', { name: `Help player ${i}`, exact: true }).click();
      await fits();
      if (!enlarged) expect(await page.locator('.answer').first().boundingBox()).toEqual(before);
      await expect(page.getByRole('button', { name: 'Pause journey' })).toBeInViewport();
    });
  }
}
