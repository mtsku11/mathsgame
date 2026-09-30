import { chromium } from '@playwright/test';
import { readdirSync } from 'node:fs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const file of readdirSync('preview').filter(name => name.endsWith('.html'))) {
  await page.goto(new URL(`preview/${file}`, import.meta.url).href);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `reference/${file.replace('.html', '.png')}` });
}
await browser.close();
