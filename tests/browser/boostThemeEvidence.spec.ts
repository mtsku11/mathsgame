import { test, expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { boostFlow, boostPhase, boostState, mash, skipToRound, startGame, tapKey } from '../helpers';

// Phase 3b review evidence: 1280x720 videos and screenshots in test-results/redesign/phase3b/.
// Off by default so the normal suite stays fast: PHASE3B_EVIDENCE=1 npx playwright test tests/browser/boostThemeEvidence.spec.ts
const out = 'test-results/redesign/phase3b';
test.skip(!process.env.PHASE3B_EVIDENCE, 'set PHASE3B_EVIDENCE=1 to record the review videos and screenshots');
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
// A screenshot `ms` into the finale, so the frame is the same moment of the payoff every time.
async function shotInFinale(page: Page, name: string, ms: number): Promise<void> {
  await expect.poll(async () => { const state = await boostState(page); return state?.phase === 'finale' && state.phaseTime >= ms; }, { timeout: 15000, intervals: [30] }).toBe(true);
  await shot(page, name);
}
// Taps the pupils' switches one at a time until the boost reaches `tier`, so a screenshot can hold a tier still.
async function tapUntilTier(page: Page, tier: number, pupils: number[]): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (((await boostState(page))?.tier ?? 0) >= tier) return;
    await tapKey(page, pupils[i % pupils.length], (i >> 2) % 2, 55);
    await page.waitForTimeout(25);
  }
}
// The crew at the start of `round`'s boost (Firework Frenzy is round 1, Bubble Blast round 3).
async function toBoost(page: Page, count: number, round: number, boost: { seconds?: number } = {}, reduced = false): Promise<void> {
  await startGame(page, { count, reduced, boost: { autoStart: false, seconds: boost.seconds ?? 20, difficulty: 'easy' } });
  await page.waitForTimeout(800);
  await skipToRound(page, count, round);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Boost round!' }).click();
}
async function fullBoost(page: Page, theme: 'firework' | 'bubble', reduced: boolean): Promise<void> {
  const prefix = `${theme}${reduced ? '-reduced' : ''}`;
  await toBoost(page, 4, theme === 'firework' ? 1 : 3, {}, reduced);
  await page.waitForTimeout(2600);
  await shot(page, `${prefix}-intro`);
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await page.waitForTimeout(700);
  // A slower beat than the safety tests use, so the tiers are seen one by one.
  await tapUntilTier(page, 1, [0, 1, 2, 3]);
  await page.waitForTimeout(350);
  await shot(page, `${prefix}-live-tier-1`);
  await tapUntilTier(page, 2, [0, 1, 2, 3]);
  await page.waitForTimeout(350);
  await shot(page, `${prefix}-live-tier-2`);
  await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 20000, step: 70, untilNotLive: true });
  if (theme === 'firework') {
    await shotInFinale(page, `${prefix}-max-barrage`, 1600);
    await shotInFinale(page, `${prefix}-max-star-face`, 4100);
    await shotInFinale(page, `${prefix}-max-glitter`, 5300);
  } else {
    await shotInFinale(page, `${prefix}-max-pop`, 350);
    await shotInFinale(page, `${prefix}-max-gum`, 1500);
    await shotInFinale(page, `${prefix}-max-giggle`, 3000);
  }
  await expect(page.locator('.sp-bbadge')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
  await shot(page, `${prefix}-wrap`);
  await expect.poll(() => boostFlow(page), { timeout: 10000 }).toBe('done');
  await page.waitForTimeout(1200);
}
async function timeout(page: Page, theme: 'firework' | 'bubble'): Promise<void> {
  await toBoost(page, 2, theme === 'firework' ? 1 : 3, { seconds: 8 });
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await page.waitForTimeout(500);
  for (let i = 0; i < 9; i++) { await tapKey(page, i % 2, (i >> 1) % 2, 70); await page.waitForTimeout(160); }
  expect(await boostState(page)).toMatchObject({ tier: 1 });
  await expect.poll(() => boostPhase(page), { timeout: 12000 }).toBe('finale');
  await shotInFinale(page, `${theme}-timeout-tier-1-finale`, 1400);
  await expect.poll(() => boostFlow(page), { timeout: 12000 }).toBe('done');
  await page.waitForTimeout(1500);
}

test('video and screenshots: a full Firework Frenzy boost with four pupils reaching MAX', async ({ browser }) => {
  await record(browser, 'firework-max-4-players', page => fullBoost(page, 'firework', false));
});
test('video and screenshots: a full Bubble Blast boost with four pupils reaching POP', async ({ browser }) => {
  await record(browser, 'bubble-max-4-players', page => fullBoost(page, 'bubble', false));
});
test('video: a Firework Frenzy boost that runs out of time ends happily at tier 1', async ({ browser }) => {
  await record(browser, 'firework-timeout-tier-1', page => timeout(page, 'firework'));
});
test('video: a Bubble Blast boost that runs out of time ends happily at tier 1', async ({ browser }) => {
  await record(browser, 'bubble-timeout-tier-1', page => timeout(page, 'bubble'));
});
test('video and screenshots: reduced-motion Firework Frenzy is a calm set of static bursts with the same information', async ({ browser }) => {
  await record(browser, 'firework-reduced-motion', page => fullBoost(page, 'firework', true), { reducedMotion: 'reduce' });
});
test('video and screenshots: reduced-motion Bubble Blast pops into a calm star cluster with the same information', async ({ browser }) => {
  await record(browser, 'bubble-reduced-motion', page => fullBoost(page, 'bubble', true), { reducedMotion: 'reduce' });
});
