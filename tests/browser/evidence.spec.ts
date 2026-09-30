import { test, expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { answerCorrectly, correctSide, nextButton, passAll, startGame, station, tapKey, wrongSide } from '../helpers';

// Phase 2 review evidence: 1280x720 videos and reduced-motion screenshots in test-results/redesign/phase2/.
// Off by default so the normal suite stays fast: PHASE2_EVIDENCE=1 npx playwright test tests/browser/evidence.spec.ts
const out = 'test-results/redesign/phase2';
test.skip(!process.env.PHASE2_EVIDENCE, 'set PHASE2_EVIDENCE=1 to record the review videos and screenshots');
test.describe.configure({ mode: 'serial' });
test.setTimeout(240000);

const size = { width: 1280, height: 720 };
const nextName = (round: number): string => round === 6 ? 'Finish journey' : 'Next round';
const baseURL = 'http://127.0.0.1:4173/';

async function record(browser: Browser, name: string, script: (page: Page) => Promise<void>): Promise<void> {
  mkdirSync(out, { recursive: true });
  const dir = `${out}/.video-${name}`;
  const context = await browser.newContext({ baseURL, viewport: size, recordVideo: { dir, size } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await script(page);
  await context.close();
  await page.video()!.saveAs(`${out}/${name}.webm`);
  rmSync(dir, { recursive: true, force: true });
  expect(errors).toEqual([]);
}

test('video: a full round with a wrong try, Help, a correct answer from each of four pupils, round ready and Next', async ({ browser }) => {
  await record(browser, 'round', async page => {
    await startGame(page, { count: 4 });
    await page.waitForTimeout(1600);
    const first = station(page, 0);
    await tapKey(page, 0, await wrongSide(first), 120);
    await page.waitForTimeout(1400);
    await page.getByRole('button', { name: 'Help player 3', exact: true }).click();
    await page.waitForTimeout(2200);
    for (let pupil = 0; pupil < 4; pupil++) {
      await tapKey(page, pupil, await correctSide(station(page, pupil)), 120);
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(3200);
    await nextButton(page).click();
    await page.waitForTimeout(2000);
  });
});

for (const count of [4, 3]) {
  test(`video: destination arrival after round 2 with ${count} pupils`, async ({ browser }) => {
    await record(browser, `arrival-${count}p`, async page => {
      await startGame(page, { count });
      await page.waitForTimeout(1200);
      for (let round = 1; round <= 2; round++) {
        for (let pupil = 0; pupil < count; pupil++) { await tapKey(page, pupil, await correctSide(station(page, pupil)), 100); await page.waitForTimeout(700); }
        await page.waitForTimeout(round === 1 ? 800 : 1500);
        await nextButton(page).click();
        await page.waitForTimeout(round === 1 ? 1600 : 4200);
      }
    });
  });
}

test('video: the finale with four pupils and the teacher observation panel', async ({ browser }) => {
  await record(browser, 'finale', async page => {
    await startGame(page, { count: 4 });
    await page.waitForTimeout(800);
    for (let round = 1; round <= 6; round++) {
      for (let pupil = 0; pupil < 4; pupil++) await answerCorrectly(page, pupil);
      await page.waitForTimeout(1100);
      await page.getByRole('button', { name: nextName(round) }).click();
      await page.waitForTimeout(700);
    }
    await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
    await page.waitForTimeout(5200);
    await page.locator('.sp-fin-summary summary').click();
    await page.waitForTimeout(1800);
  });
});

test('screenshots: the same moments in reduced motion, plus full-motion frames', async ({ browser }) => {
  mkdirSync(out, { recursive: true });
  const context = await browser.newContext({ baseURL, viewport: size });
  const page = await context.newPage();
  await startGame(page, { count: 4, reduced: true });
  await page.evaluate(() => document.fonts.load('64px "Titan One"').then(() => document.fonts.ready));
  const shot = (name: string) => page.screenshot({ path: `${out}/${name}.png` });
  await shot('reduced-1-deal');
  await tapKey(page, 0, await wrongSide(station(page, 0)), 120);
  await expect(station(page, 0).locator('.sp-pill')).toHaveText('Try again');
  await page.waitForTimeout(300);
  await shot('reduced-2-try-again');
  await page.getByRole('button', { name: 'Help player 3', exact: true }).click();
  await page.waitForTimeout(200);
  await shot('reduced-3-help');
  await page.waitForTimeout(500);
  for (let pupil = 0; pupil < 4; pupil++) {
    await tapKey(page, pupil, await correctSide(station(page, pupil)), 100);
    await page.waitForTimeout(650);
    if (pupil === 0) await shot('reduced-4-correct');
  }
  await page.waitForTimeout(300);
  await shot('reduced-5-round-ready');
  await nextButton(page).click();
  await passAll(page, 4);
  await nextButton(page).click();
  await page.waitForTimeout(300);
  await shot('reduced-6-destination-arrival');
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.waitForTimeout(100);
  await shot('reduced-7-pass');
  for (let round = 3; round <= 6; round++) {
    for (let pupil = 1; pupil <= 4; pupil++) { const pass = page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }); if (await pass.isEnabled()) await pass.click(); }
    await page.getByRole('button', { name: nextName(round) }).click();
  }
  await page.waitForTimeout(400);
  await shot('reduced-8-finale');
  await context.close();

  const full = await browser.newContext({ baseURL, viewport: size });
  const live = await full.newPage();
  await startGame(live, { count: 4 });
  await live.evaluate(() => document.fonts.load('64px "Titan One"').then(() => document.fonts.ready));
  await live.waitForTimeout(700);
  await live.screenshot({ path: `${out}/full-1-deal-in.png` });
  await live.waitForTimeout(700);
  await tapKey(live, 0, await wrongSide(station(live, 0)), 120);
  await live.waitForTimeout(230);
  await live.screenshot({ path: `${out}/full-2-try-again-wobble.png` });
  await live.waitForTimeout(700);
  await Promise.all([1, 2, 3].map(async pupil => tapKey(live, pupil, await correctSide(station(live, pupil)), 100)));
  await live.waitForTimeout(420);
  await live.screenshot({ path: `${out}/full-3-burst-and-flight.png` });
  await live.waitForTimeout(500);
  await live.screenshot({ path: `${out}/full-4-arriving.png` });
  await tapKey(live, 0, await correctSide(station(live, 0)), 100);
  await live.waitForTimeout(1500);
  await live.screenshot({ path: `${out}/full-5-round-ready.png` });
  await full.close();
});
