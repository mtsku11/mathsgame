import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startGame } from '../helpers';

const shots = 'test-results/redesign/phase6';
mkdirSync(shots, { recursive: true });
const sizes = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }] as const;

for (const count of [3, 4]) {
  test(`spotlight screenshots with ${count} pupils`, async ({ page }) => {
    for (const size of sizes) {
      await page.setViewportSize(size);
      await startGame(page, { count, enlarged: true, presets: ['add10', 'add10', 'add10', 'add10'].slice(0, count) });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${shots}/spotlight-${count}p-${size.width}x${size.height}.png` });
    }
  });
}
