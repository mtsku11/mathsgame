import { test, expect, type Page } from '@playwright/test';

declare global { interface Window { __NC_TEST__?: boolean } }

const run = <T>(page: Page, body: (motion: typeof import('../../src/ui/fx/motion')) => Promise<T>): Promise<T> =>
  page.evaluate(`(async () => (${body.toString()})(await import('/src/ui/fx/motion.ts')))()`) as Promise<T>;

test('window.__NC_TEST__ enables instant mode without a query string', async ({ page }) => {
  await page.addInitScript(() => { window.__NC_TEST__ = true; });
  await page.goto('./');
  await expect(page.locator('html')).toHaveClass(/nc-instant/);
  await page.waitForTimeout(400);
  expect(await page.locator('.sp-pilot').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === 'none'))).toBe(true);
  await expect(page.locator('.fx-canvas')).toHaveCount(0);
});

test('instant mode completes long timelines within a frame and creates no idle loops', async ({ page }) => {
  await page.goto('./?instant');
  const result = await run(page, async motion => {
    const el = document.createElement('div');
    document.body.append(el);
    const tl = motion.timeline();
    tl.to(el, { x: 100, duration: 5 }).to(el, { y: 40, duration: 5 });
    await new Promise(resolve => setTimeout(resolve, 300));
    return { done: tl.progress(), transform: el.style.transform, idle: motion.idle(el, { y: 5, duration: 1 }), instant: motion.isInstant(), calm: motion.isCalm() };
  });
  expect(result).toEqual({ done: 1, transform: 'translate(100px, 40px)', idle: null, instant: true, calm: true });
});

test('reduced motion snaps tweens and timelines to their end state; full motion animates', async ({ page }) => {
  await page.goto('./');
  const result = await run(page, async motion => {
    const box = (name: string) => { const el = document.createElement('div'); el.id = name; document.body.append(el); return el; };
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(box);
    motion.setReducedMotion(true);
    motion.to(a, { x: 50, duration: 5 });
    const tl = motion.timeline();
    tl.to(b, { x: 60, duration: 5, delay: 2 });
    motion.setReducedMotion(false);
    motion.to(c, { x: 70, duration: 5 });
    const full = motion.timeline();
    full.to(d, { x: 80, duration: 5 });
    await new Promise(resolve => setTimeout(resolve, 300));
    return { snapped: [a.style.transform, b.style.transform], reducedTimeline: tl.progress(), animating: [c.style.transform !== 'translate(70px, 0px)', full.progress() < 1], reducedFlag: motion.isReduced() };
  });
  expect(result.snapped).toEqual(['translate(50px, 0px)', 'translate(60px, 0px)']);
  expect(result.reducedTimeline).toBe(1);
  expect(result.animating).toEqual([true, true]);
  expect(result.reducedFlag).toBe(false);
});

test('low stimulation and reduced motion toggle at runtime and switch off idle loops', async ({ page }) => {
  await page.goto('./');
  const result = await run(page, async motion => {
    const el = document.createElement('div');
    document.body.append(el);
    const running = motion.idle(el, { y: 5, duration: 1 });
    running?.kill();
    motion.setLowStim(true);
    const lowStim = { idle: motion.idle(el, { y: 5, duration: 1 }), calm: motion.isCalm(), cls: document.documentElement.classList.contains('nc-lowstim') };
    motion.setLowStim(false);
    motion.setReducedMotion(true);
    const reduced = { idle: motion.idle(el, { y: 5, duration: 1 }), cls: document.documentElement.classList.contains('nc-reduced') };
    motion.setReducedMotion(false);
    return { hadIdle: running !== null, lowStim, reduced, after: document.documentElement.className };
  });
  expect(result.hadIdle).toBe(true);
  expect(result.lowStim).toEqual({ idle: null, calm: true, cls: true });
  expect(result.reduced).toEqual({ idle: null, cls: true });
  expect(result.after).not.toMatch(/nc-reduced|nc-lowstim/);
});
