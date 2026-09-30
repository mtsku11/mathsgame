import { test, expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { boostFlow, boostPhase, boostState, countOf, mash, nextButton, passAll, recordBoost, startGame, tapKey } from '../helpers';

// Phase 3a review evidence: 1280x720 videos and screenshots in test-results/redesign/phase3a/.
// Off by default so the normal suite stays fast: PHASE3A_EVIDENCE=1 npx playwright test tests/browser/boostEvidence.spec.ts
const out = 'test-results/redesign/phase3a';
test.skip(!process.env.PHASE3A_EVIDENCE, 'set PHASE3A_EVIDENCE=1 to record the review videos and screenshots');
test.describe.configure({ mode: 'serial' });
test.setTimeout(240000);

const size = { width: 1280, height: 720 };
const baseURL = 'http://127.0.0.1:4173/';

async function record(browser: Browser, name: string, script: (page: Page) => Promise<void>, options: { reducedMotion?: 'reduce' } = {}): Promise<void> {
  mkdirSync(out, { recursive: true });
  const dir = `${out}/.video-${name}`;
  const context = await browser.newContext({ baseURL, viewport: size, recordVideo: { dir, size }, reducedMotion: options.reducedMotion ?? 'no-preference' });
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
const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: `${out}/${name}.png` });
// Taps the pupils' switches one at a time until the boost reaches `tier`, so a screenshot can hold a tier still.
async function tapUntilTier(page: Page, tier: number, pupils: number[]): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (((await boostState(page))?.tier ?? 0) >= tier) return;
    await tapKey(page, pupils[i % pupils.length], (i >> 2) % 2, 55);
    await page.waitForTimeout(25);
  }
}

// Round 1 with its boost skipped, so that round 2 (Warp Drive) is next.
async function toWarpRound(page: Page, count: number, boost: { seconds?: number; difficulty?: 'easy' | 'normal' | 'hard' } = {}, reduced = false): Promise<void> {
  await startGame(page, { count, reduced, boost: { autoStart: false, seconds: boost.seconds ?? 12, difficulty: boost.difficulty ?? 'easy' } });
  await page.waitForTimeout(800);
  await passAll(page, count);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip boost round' }).click();
  await page.waitForTimeout(900);
  await nextButton(page).click();
  await page.waitForTimeout(1200);
  await passAll(page, count);
  await page.waitForTimeout(1800);
}

test('video and screenshots: a full Warp Drive boost with four pupils reaching MAX, arrival and wrap', async ({ browser }) => {
  await record(browser, 'warp-max-4-players', async page => {
    await toWarpRound(page, 4, { seconds: 20 });
    await recordBoost(page);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await page.waitForTimeout(2600);
    await shot(page, 'intro');
    await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
    await page.waitForTimeout(700);
    // A slower beat than the safety tests use, so the tiers are seen one by one.
    await tapUntilTier(page, 1, [0, 1, 2, 3]);
    await page.waitForTimeout(350);
    await shot(page, 'live-tier-1');
    await tapUntilTier(page, 2, [0, 1, 2, 3]);
    await page.waitForTimeout(350);
    await shot(page, 'live-tier-2');
    await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 20000, step: 70, untilNotLive: true });
    await page.waitForTimeout(1000);
    await shot(page, 'max-tunnel');
    await expect.poll(() => countOf(page, 'destinationReached'), { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(900);
    await shot(page, 'arrival');
    await expect(page.locator('.sp-bbadge')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(600);
    await shot(page, 'wrap');
    await expect.poll(() => boostFlow(page), { timeout: 10000 }).toBe('done');
    await page.waitForTimeout(1200);
    await shot(page, 'back-on-play-screen');
  });
});

test('video: a Warp Drive boost that runs out of time ends happily at tier 1', async ({ browser }) => {
  await record(browser, 'warp-timeout-tier-1', async page => {
    await toWarpRound(page, 2, { seconds: 8, difficulty: 'easy' });
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
    await page.waitForTimeout(500);
    for (let i = 0; i < 9; i++) { await tapKey(page, i % 2, (i >> 1) % 2, 70); await page.waitForTimeout(160); }
    expect(await boostState(page)).toMatchObject({ tier: 1 });
    await expect.poll(() => boostPhase(page), { timeout: 12000 }).toBe('finale');
    await page.waitForTimeout(1500);
    await shot(page, 'timeout-tier-1-finale');
    await expect.poll(() => boostFlow(page), { timeout: 12000 }).toBe('done');
    await page.waitForTimeout(1500);
  });
});

test('video: the placeholder theme (Firework Frenzy round) with three pupils reaching MAX', async ({ browser }) => {
  await record(browser, 'placeholder-theme-max', async page => {
    await startGame(page, { count: 3, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
    await page.waitForTimeout(800);
    await passAll(page, 3);
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
    await page.waitForTimeout(500);
    await mash(page, { mode: 'keys', pupils: [0, 1, 2], ms: 20000, step: 70, untilNotLive: true });
    await page.waitForTimeout(1200);
    await shot(page, 'placeholder-max');
    await expect.poll(() => boostFlow(page), { timeout: 12000 }).toBe('done');
    await page.waitForTimeout(1200);
  });
});

test('video and screenshots: reduced-motion Warp Drive is a calm fade with the same information', async ({ browser }) => {
  await record(browser, 'warp-reduced-motion', async page => {
    await toWarpRound(page, 4, { seconds: 20 }, true);
    await recordBoost(page);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
    await page.waitForTimeout(500);
    await tapUntilTier(page, 2, [0, 1, 2, 3]);
    await page.waitForTimeout(350);
    await shot(page, 'reduced-live-tier-2');
    await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 20000, step: 70, untilNotLive: true });
    await page.waitForTimeout(1000);
    await shot(page, 'reduced-max');
    await expect.poll(() => countOf(page, 'destinationReached'), { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(900);
    await shot(page, 'reduced-arrival');
    await expect.poll(() => boostFlow(page), { timeout: 10000 }).toBe('done');
    await page.waitForTimeout(1200);
  }, { reducedMotion: 'reduce' });
});
