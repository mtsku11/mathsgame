import { test, expect, type Page } from '@playwright/test';
import { boostFlow, boostLog, boostPhase, boostState, mash, nextButton, passAll, recordBoost, skipToRound, startController, startGame, tapKey, type Logged } from '../helpers';

// Phase 3b: the Firework Frenzy (rounds 1 and 5) and Bubble Blast (round 3) boost themes, on the engine Phase 3a built.
const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};
const names = (log: Logged[], ...wanted: string[]): string[] => log.filter(entry => wanted.includes(entry.name)).map(entry => entry.name === 'boostTier' || entry.name === 'boostFinale' || entry.name === 'boostEnd' ? `${entry.name}${entry.payload?.tier}` : entry.name);
const easy = { autoStart: false, seconds: 20, difficulty: 'easy' } as const;
const spawned = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { spawned: number } } } }).__nc.particles.particleStats().spawned);
const untilDone = (page: Page, timeout = 20000): Promise<void> => expect.poll(() => boostFlow(page), { timeout }).toBe('done');
const startRound = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
};

const themes = [
  { name: 'Firework Frenzy', scene: 'fireworkFrenzy', round: 1, card: '.sp-bgiant.is-firework', word: 'MEGA BOOST!' },
  { name: 'Bubble Blast', scene: 'bubbleBlast', round: 3, card: '.sp-bgiant.is-pop', word: 'POP!' },
] as const;

test.describe.configure({ mode: 'parallel' });

test('rounds 1 to 6 play Firework Frenzy, Warp Drive, Bubble Blast, Warp Drive, Firework Frenzy, Warp Drive, one scene at a time', async ({ page }) => {
  test.setTimeout(150000);
  const errors = errorsOf(page);
  await startGame(page, { count: 1, boost: { autoStart: false } });
  const seen: (string | null)[] = [];
  for (let round = 1; round <= 6; round++) {
    await passAll(page, 1);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await expect(page.locator('[data-boost-scene]')).toHaveCount(1);
    seen.push(await page.locator('[data-boost-scene]').getAttribute('data-boost-scene'));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Skip boost round' }).click();
    // After round 6 the boost leads straight to the mission-complete screen.
    if (round < 6) { await nextButton(page).click(); await expect(page.locator('[data-boost-scene]')).toHaveCount(0, { timeout: 4000 }); }
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible({ timeout: 10000 });
  expect(seen).toEqual(['fireworkFrenzy', 'warpDrive', 'bubbleBlast', 'warpDrive', 'fireworkFrenzy', 'warpDrive']);
  expect(errors).toEqual([]);
});

for (const theme of themes) {
  test(`${theme.name}: four pupils mashing a shared XAC reach tiers 1, 2 and 3, the scene follows the press and MAX ends the live phase early`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = errorsOf(page);
    await startController(page, { count: 4, boost: easy });
    await skipToRound(page, 4, theme.round);
    await recordBoost(page);
    await startRound(page);
    await expect(page.locator(`[data-boost-scene="${theme.scene}"]`)).toHaveCount(1);
    const before = await spawned(page);
    // Every 25 ms while the pupils press: rockets in flight and the fireworks' particle count, or the bubble's size and Gloop's eyes.
    await page.evaluate(() => {
      const samples = { rockets: [] as number[], bubble: [] as number[], eyes: [] as number[], beams: 0, bubbleAtTier: {} as Record<number, number> };
      (window as unknown as { __themeSamples: typeof samples }).__themeSamples = samples;
      window.setInterval(() => {
        const rockets = document.querySelector<HTMLElement>('.sp-fw')?.dataset.rockets;
        // The ten-rocket cap is a live-phase rule; the finale's waves launch on top of any rockets still in flight.
        const live = (window as unknown as { __nc: { boost: { state: { phase: string } | null } } }).__nc.boost.state?.phase === 'live';
        if (rockets !== undefined && live) samples.rockets.push(Number(rockets));
        const bubble = document.querySelector('.sp-bb-bubble');
        if (bubble) samples.bubble.push(bubble.getBoundingClientRect().width);
        const eye = document.querySelector('.gl-eye');
        if (eye) samples.eyes.push(Number(eye.getAttribute('r')));
        samples.beams = Math.max(samples.beams, document.querySelectorAll('.sp-bbeam').length);
      }, 25);
    });
    await mash(page, { mode: 'xac', pupils: [0, 1, 2, 3], ms: 15000, untilNotLive: true });
    const log = await boostLog(page);
    expect(names(log, 'boostStart', 'boostGo', 'boostTier', 'boostFinale')).toEqual(['boostStart', 'boostGo', 'boostTier1', 'boostTier2', 'boostTier3', 'boostFinale3']);
    const samples = await page.evaluate(() => (window as unknown as { __themeSamples: { rockets: number[]; bubble: number[]; eyes: number[]; beams: number } }).__themeSamples);
    expect(await spawned(page)).toBeGreaterThan(before + 100);
    if (theme.scene === 'fireworkFrenzy') {
      // A rocket leaves the saucer with each press, never more than ten at once, and there are no bolts or beams to wait for.
      expect(Math.max(...samples.rockets)).toBeGreaterThan(2);
      expect(Math.max(...samples.rockets)).toBeLessThanOrEqual(10);
      expect(samples.beams).toBe(0);
    } else {
      // The bubble grows with the meter and Gloop's eyes widen tier by tier.
      const widths = samples.bubble;
      expect(Math.max(...widths)).toBeGreaterThan(widths[0] * 2.2);
      expect(Math.min(...samples.eyes)).toBe(30);
      expect(Math.max(...samples.eyes)).toBeGreaterThanOrEqual(35.9);
      expect(Math.max(...samples.eyes)).toBeLessThan(38);
      expect(samples.beams).toBe(4);
    }
    await expect(page.locator(theme.card)).toHaveText(theme.word);
    await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 15000 });
    await untilDone(page);
    expect(names(await boostLog(page), 'boostEnd')).toEqual(['boostEnd3']);
    await expect(nextButton(page)).toBeVisible();
    await expect(page.locator('.sp-btop, .sp-bworld, [data-boost-scene]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${theme.name}: a boost that runs out of time at tier 1 still plays a happy finale, then the round carries on`, async ({ page }) => {
    test.setTimeout(90000);
    const errors = errorsOf(page);
    await startGame(page, { count: 2, boost: { autoStart: false, seconds: 8, difficulty: 'easy' } });
    await skipToRound(page, 2, theme.round);
    await recordBoost(page);
    await startRound(page);
    await page.waitForTimeout(400);
    for (let i = 0; i < 9; i++) { await tapKey(page, i % 2, (i >> 1) % 2, 70); await page.waitForTimeout(150); }
    expect(await boostState(page)).toMatchObject({ tier: 1 });
    await expect.poll(() => boostPhase(page), { timeout: 12000 }).toBe('finale');
    expect(names(await boostLog(page), 'boostTier', 'boostFinale')).toEqual(['boostTier1', 'boostFinale1']);
    await expect(page.locator(theme.card)).toBeVisible();
    await expect(page.locator('.sp-bbadge')).toHaveText('Boost!', { timeout: 8000 });
    await untilDone(page, 10000);
    await expect(nextButton(page)).toBeVisible();
    await expect(page.locator('.sp-btop, .sp-bworld, [data-boost-scene]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const mode of ['reduced motion', 'low stimulation'] as const) {
    test(`${theme.name} with ${mode}: same information as static shapes, no travel, no shake, no console errors`, async ({ page }) => {
      test.setTimeout(90000);
      const errors = errorsOf(page);
      await startGame(page, { count: 2, reduced: mode === 'reduced motion', boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
      await skipToRound(page, 2, theme.round);
      if (mode === 'low stimulation') await page.evaluate(() => (window as unknown as { __nc: { motion: { setLowStim(value: boolean): void } } }).__nc.motion.setLowStim(true));
      await recordBoost(page);
      await startRound(page);
      const before = await spawned(page);
      await mash(page, { mode: 'keys', pupils: [0, 1], ms: 10000, untilNotLive: true });
      expect(names(await boostLog(page), 'boostTier', 'boostFinale')).toEqual(['boostTier1', 'boostTier2', 'boostTier3', 'boostFinale3']);
      await expect(page.locator(theme.card)).toBeVisible({ timeout: 6000 });
      if (theme.scene === 'fireworkFrenzy') {
        // Static bursts fade in and out; nothing flies, so no rocket is ever in flight.
        await expect.poll(() => page.locator('.sp-fw-static use').count(), { timeout: 6000 }).toBeGreaterThan(3);
        expect(await page.locator('.sp-fw').getAttribute('data-rockets')).toBe('0');
      } else {
        await expect(page.locator('.sp-bb-cluster-wrap')).toBeVisible({ timeout: 6000 });
        await expect(page.locator('.sp-bb-splat')).toHaveCount(0);
      }
      if (mode === 'reduced motion') expect(await spawned(page)).toBe(before);
      expect(await page.locator('.fx-canvas').evaluate(canvas => getComputedStyle(canvas).transform)).toBe('none');
      await expect(page.locator('.sp-bbadge')).toHaveText('Mega boost!', { timeout: 10000 });
      await untilDone(page, 10000);
      expect(errors).toEqual([]);
    });
  }

  test(`${theme.name}: no beams linger into the payoff, and the tier badge sits centred above the saucer row`, async ({ page }) => {
    test.setTimeout(90000);
    await startGame(page, { count: 4, boost: easy });
    await skipToRound(page, 4, theme.round);
    await startRound(page);
    await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 15000, untilNotLive: true });
    expect(await boostPhase(page)).toBe('finale');
    // Every beam is gone within half a second of the live phase ending.
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => [...document.querySelectorAll('.sp-bbeam')].every(beam => getComputedStyle(beam).visibility === 'hidden'))).toBe(true);
    await expect(page.locator('.sp-bbadge')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(700);
    const box = await page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect(), scale = stage.width / 1280;
      const badge = document.querySelector('.sp-bbadge')!.getBoundingClientRect(), saucer = document.querySelector('.sp-bsaucer')!.getBoundingClientRect();
      return { centre: (badge.left + badge.width / 2 - stage.left) / scale, top: (badge.top - stage.top) / scale, bottom: (badge.bottom - stage.top) / scale, saucerTop: (saucer.top - stage.top) / scale };
    });
    expect(Math.abs(box.centre - 640)).toBeLessThan(6);
    expect(box.bottom).toBeLessThanOrEqual(box.saucerTop);
    expect(box.top).toBeGreaterThan(400);
  });
}

test('the Warp Drive arrival wrap keeps the tier badge clear of the hub, the new planet and the welcome card, above the saucer row', async ({ page }) => {
  test.setTimeout(90000);
  await startGame(page, { count: 4, boost: easy });
  await skipToRound(page, 4, 2);
  await startRound(page);
  await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 15000, untilNotLive: true });
  await expect(page.locator('.sp-bbadge')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800);
  const rects = await page.evaluate(() => {
    const stage = document.querySelector('.stage')!.getBoundingClientRect(), scale = stage.width / 1280;
    const of = (selector: string): { left: number; top: number; right: number; bottom: number } | null => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: (box.left - stage.left) / scale, top: (box.top - stage.top) / scale, right: (box.right - stage.left) / scale, bottom: (box.bottom - stage.top) / scale };
    };
    return { badge: of('.sp-bbadge')!, hub: of('.sp-hub')!, planet: of('.sp-dest-planet')!, card: of('.sp-card')!, saucer: of('.sp-bsaucer')! };
  });
  const apart = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }): boolean => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  expect(apart(rects.badge, rects.hub)).toBe(true);
  expect(apart(rects.badge, rects.planet)).toBe(true);
  expect(apart(rects.badge, rects.card)).toBe(true);
  expect(rects.badge.bottom).toBeLessThanOrEqual(rects.saucer.top);
  expect(rects.badge.left).toBeGreaterThanOrEqual(0);
});
