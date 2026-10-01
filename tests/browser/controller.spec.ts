import { test, expect, type Page } from '@playwright/test';
import { correctSide, openSetup, station } from '../helpers';

async function press(page: Page, buttons: number[]) {
  await page.evaluate(buttons => window.dispatchEvent(new CustomEvent('mock-buttons', { detail: buttons })), buttons);
  await page.waitForTimeout(150);
}
async function mapAndCheck(page: Page, count: number) {
  // Each step waits for the screen to accept the next press or release, so a slow CI runner cannot miss a short press.
  const status = page.locator('#calibration-status');
  for (let i = 0; i < count * 2; i++) {
    await page.locator('.map-button').nth(i).click();
    await expect(status).toContainText('Press one switch');
    await press(page, [i]);
    await expect(status).toContainText('Now release that switch');
    await press(page, []);
    await expect(page.locator('.map-button').nth(i)).toContainText('checked');
  }
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(600);
  for (const side of [0, 1]) {
    const caps = page.locator(`.ck-cap[data-answer-side="${side}"]`);
    await press(page, Array.from({ length: count }, (_, i) => i * 2 + side));
    for (let i = 0; i < count; i++) await expect(caps.nth(i)).not.toHaveClass(/is-ready/);
    await press(page, []);
    for (let i = 0; i < count; i++) await expect(caps.nth(i)).toHaveAttribute('aria-label', /, checked$/);
    await page.waitForTimeout(600);
  }
}
for (const count of [1, 2, 3, 4]) {
  test(`simulated shared XAC: ${count} pupils calibrate and recover without losing progress`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      let connected = true;
      let unrelatedConnected = true;
      let pressed: number[] = [];
      let slot = 0;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [connected ? {
        index: slot, id: 'Simulated XAC', connected: true, mapping: 'standard', axes: [0, 1],
        buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 }))
      } : null, unrelatedConnected ? {
        index: 9, id: 'Unassigned controller', connected: true, mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 4 }, () => ({ pressed: false, value: 0 }))
      } : null] });
      window.addEventListener('mock-buttons', event => { pressed = (event as CustomEvent<number[]>).detail; });
      window.addEventListener('mock-unrelated-disconnect', () => {
        unrelatedConnected = false;
        const event = new Event('gamepaddisconnected');
        Object.defineProperty(event, 'gamepad', { value: { index: 9 } });
        window.dispatchEvent(event);
      });
      window.addEventListener('mock-connection', event => {
        connected = (event as CustomEvent<boolean>).detail;
        if (connected) slot = 2;
      });
    });
    await openSetup(page);
    await page.getByLabel('Crew size').selectOption(String(count));
    await page.getByRole('button', { name: 'Set up the switches' }).click();
    await expect(page.locator('#diagnostic-text')).toContainText('8 buttons · 2 axes');
    await expect(page.locator('#diagnostic-text')).toContainText('1: 1.00');
    await mapAndCheck(page, count);
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(600);
    const first = station(page, 0);
    await press(page, [await correctSide(first)]); await press(page, []);
    await expect(first.locator('.sp-pill')).toHaveText('Star sent!');
    const before = await page.locator('.sp-st').allTextContents();
    await page.evaluate(() => window.dispatchEvent(new Event('mock-unrelated-disconnect')));
    await page.waitForTimeout(250);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.locator('.sp-st').allTextContents()).toEqual(before);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mock-connection', { detail: false })));
    await expect(page.getByRole('dialog')).toContainText('disconnected');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mock-connection', { detail: true })));
    await page.getByRole('button', { name: 'Reconnect & check switches' }).click();
    await expect(page.locator('#diagnostic-text')).toContainText('Slot 0: no longer reported');
    await expect(page.locator('#diagnostic-text')).toContainText('Slot 2: detected');
    await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeDisabled();
    await mapAndCheck(page, count);
    await page.getByRole('button', { name: 'Resume journey' }).click();
    await expect(page.locator('.sp-st')).toHaveCount(count);
    expect(await page.locator('.sp-st').allTextContents()).toEqual(before);
    await expect(station(page, 0).locator('.sp-pill')).toHaveText('Star sent!');
    await expect(page.locator('.sp-core-num')).toHaveText('1');
    expect(errors).toEqual([]);
  });
}
