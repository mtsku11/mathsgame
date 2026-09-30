import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { answerCorrectly, boostPhase, installXac, mapAndCheck, mash, nextButton, openSetup, setBoost, startGame } from '../helpers';

// Screenshots for docs/TEACHER-GUIDE.md, 1280x720, written to docs/images/. They were then reduced to 128-colour PNGs with Pillow (Image.quantize) to stay under 300 KB.
// Off by default: GUIDE_SHOTS=1 npx playwright test tests/browser/guideScreenshots.spec.ts
const out = 'docs/images';
test.skip(!process.env.GUIDE_SHOTS, 'set GUIDE_SHOTS=1 to capture the teacher guide screenshots');
test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(120000);

const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: `${out}/${name}.png` });

// Everyone answers correctly, except that the last pilot passes when `passOne` is set, so the teacher summary shows a mix.
async function answerRound(page: Page, passOne = false): Promise<void> {
  await answerCorrectly(page, 0); await answerCorrectly(page, 1);
  if (passOne) await page.getByRole('button', { name: 'Pass player 3', exact: true }).click(); else await answerCorrectly(page, 2);
}

test('teacher guide screenshots', async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  await shot(page, '01-title');

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Crew size').selectOption('3');
  await page.getByLabel('Player 2 maths').selectOption('add5');
  await page.getByLabel('Player 3 maths').selectOption('add10');
  await page.waitForTimeout(400);
  await shot(page, '02-setup');

  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Low stimulation').scrollIntoViewIfNeeded();
  await page.locator('details.tp-details').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('details.tp-details')!.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await shot(page, '03-setup-comfort');

  await startGame(page, { count: 3, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  await page.waitForTimeout(800);
  await shot(page, '05-play');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await shot(page, '06-pause');
});

test('teacher guide screenshots: switches, check-in, boost, finale', async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await installXac(page);
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption('3');
  await setBoost(page, { autoStart: false, seconds: 12, difficulty: 'easy' });
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await page.waitForTimeout(500);
  await page.locator('.map-button').nth(0).click();
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.sw-grid')!.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(200);
  await shot(page, '04-switches');
  await mapAndCheck(page, 3);
  await page.waitForTimeout(400);
  await shot(page, '04b-checkin');
  await page.getByRole('button', { name: 'Start mission' }).click();
  await page.waitForTimeout(800);
  await answerRound(page);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await mash(page, { mode: 'xac', pupils: [0, 1, 2], ms: 1500 });
  await shot(page, '07-boost');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  // Rounds 2-6: pass everyone and skip the boost; skipping round 6's boost ends the mission by itself.
  for (let round = 1; round <= 6; round++) {
    if (round > 1) { await answerRound(page, round === 2); await page.getByRole('button', { name: 'Boost round!' }).click(); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Skip boost round' }).click(); }
    if (round < 6) { await nextButton(page).click(); await page.waitForTimeout(500); }
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await page.waitForTimeout(6000);
  await shot(page, '08-finale');
  await page.getByText('Teacher observation · this session only').click();
  await page.waitForTimeout(800);
  await shot(page, '09-finale-summary');
});
