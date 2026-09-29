import { test, expect, type Page } from '@playwright/test';

async function press(page: Page, buttons: number[]) {
  await page.evaluate(buttons => window.dispatchEvent(new CustomEvent('mock-buttons', { detail: buttons })), buttons);
  await page.waitForTimeout(150);
}
async function mapAndCheck(page: Page, count: number) {
  for (let i = 0; i < count * 2; i++) {
    await page.locator('.map-button').nth(i).click();
    await page.waitForTimeout(150);
    await press(page, [i]); await press(page, []);
    await expect(page.locator('.map-button').nth(i)).toContainText('checked');
  }
  await page.getByRole('button', { name: 'Check switches in practice' }).click();
  await page.waitForTimeout(600);
  await press(page, Array.from({ length: count }, (_, i) => i * 2));
  await press(page, []); await page.waitForTimeout(600);
  await press(page, Array.from({ length: count }, (_, i) => i * 2 + 1));
  await press(page, []);
}
for (const count of [3, 4]) {
  test(`simulated shared XAC: ${count} pupils calibrate and recover without losing progress`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      let connected = true;
      let pressed: number[] = [];
      let slot = 0;
      Object.defineProperty(navigator, 'getGamepads', { value: () => connected ? [{
        index: slot, id: 'Simulated XAC', connected: true, mapping: 'standard', axes: [0, 1],
        buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 }))
      }] : [] });
      window.addEventListener('mock-buttons', event => { pressed = (event as CustomEvent<number[]>).detail; });
      window.addEventListener('mock-connection', event => {
        connected = (event as CustomEvent<boolean>).detail;
        if (connected) slot = 2;
      });
    });
    await page.goto('./');
    await page.getByLabel('Crew size').selectOption(String(count));
    await page.getByRole('button', { name: 'Set up the switches' }).click();
    await expect(page.locator('#diagnostic-text')).toContainText('8 buttons · 2 axes');
    await expect(page.locator('#diagnostic-text')).toContainText('1: 1.00');
    await mapAndCheck(page, count);
    await page.getByRole('button', { name: 'Launch the journey' }).click();
    await page.waitForTimeout(600);
    const first = page.locator('.station').first();
    const total = await first.locator('.question-area .dot').count();
    const side = (await first.locator('.answer-value').allTextContents()).findIndex(value => Number(value) === total);
    await press(page, [side]); await press(page, []);
    await expect(first).toContainText('Cargo ready');
    const before = await page.locator('.station').allTextContents();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mock-connection', { detail: false })));
    await expect(page.getByRole('dialog')).toContainText('disconnected');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mock-connection', { detail: true })));
    await page.getByRole('button', { name: 'Reconnect & check switches' }).click();
    await expect(page.locator('#diagnostic-text')).toContainText('Slot 0: no longer reported');
    await expect(page.locator('#diagnostic-text')).toContainText('Slot 2: detected');
    await expect(page.getByRole('button', { name: 'Check switches in practice' })).toBeDisabled();
    await mapAndCheck(page, count);
    await page.getByRole('button', { name: 'Resume journey' }).click();
    expect(await page.locator('.station').allTextContents()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
