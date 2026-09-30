import { test, expect, type Page } from '@playwright/test';
import { openSetup, passAll, startGame } from '../helpers';

interface Box { x: number; y: number; width: number; height: number }
const sizes = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];
const configs = [
  { label: '1 player', count: 1, enlarged: false, stations: 1 },
  { label: '2 players', count: 2, enlarged: false, stations: 2 },
  { label: '3 players', count: 3, enlarged: false, stations: 3 },
  { label: '4 players', count: 4, enlarged: false, stations: 4 },
  { label: '4 players enlarged', count: 4, enlarged: true, stations: 1 },
];

const boxes = (page: Page, selector: string): Promise<Box[]> => page.locator(selector).evaluateAll(elements => elements.map(element => {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}));
const inside = (inner: Box, outer: Box): boolean => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

async function expectLayout(page: Page, stations: number, scale: number): Promise<void> {
  const [stage] = await boxes(page, '.stage');
  const [hud] = await boxes(page, '.sp-hud');
  const [hub] = await boxes(page, '.sp-hub');
  const cards = await boxes(page, '.sp-st');
  expect(cards).toHaveLength(stations);
  expect(inside(hud, stage), 'hud').toBe(true);
  expect(inside(hub, stage), 'hub').toBe(true);
  expect(overlaps(hud, hub), 'hud/hub').toBe(false);
  expect(inside((await boxes(page, '.sp-ship'))[0], hub), 'mothership').toBe(true);
  for (const [i, card] of cards.entries()) {
    expect(inside(card, stage), `station ${i} in stage`).toBe(true);
    expect(overlaps(card, hud), `station ${i} vs hud`).toBe(false);
    expect(overlaps(card, hub), `station ${i} vs hub`).toBe(false);
    cards.slice(i + 1).forEach((other, k) => expect(overlaps(card, other), `station ${i} vs ${i + 1 + k}`).toBe(false));
  }
  const controls = await boxes(page, '.sp-pause, .sp-logo, .sp-route');
  for (const control of controls) { expect(inside(control, stage)).toBe(true); cards.forEach(card => expect(overlaps(control, card)).toBe(false)); }

  for (let i = 0; i < stations; i++) {
    const card = page.locator('.sp-st').nth(i);
    const buttons = await card.locator('.sp-btn').evaluateAll(elements => elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height, size: parseFloat(getComputedStyle(element).fontSize) };
    }));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(inside(button, stage), `answer ${i} in stage`).toBe(true);
      expect(inside(button, cards[i]), `answer ${i} in station`).toBe(true);
      expect(button.width / scale, `answer ${i} width`).toBeGreaterThanOrEqual(112);
      expect(button.height / scale, `answer ${i} height`).toBeGreaterThanOrEqual(112);
      expect(button.size, `numeral ${i}`).toBeGreaterThanOrEqual(56);
    }
    expect(overlaps(buttons[0], buttons[1]), `answers ${i}`).toBe(false);
    const prompt = await card.locator('.sp-prompt').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(prompt, `prompt ${i}`).toBeGreaterThanOrEqual(28);
    const objects = await card.locator('.sp-obj').evaluateAll(elements => elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    const zone = (await card.locator('.sp-objs').evaluate(element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; }));
    expect(objects.length).toBeGreaterThan(0);
    for (const object of objects) {
      expect(inside(object, zone), `object in counting area ${i}`).toBe(true);
      for (const button of buttons) expect(overlaps(object, button), `object vs answer ${i}`).toBe(false);
    }
    const pill = card.locator('.sp-pill');
    if (await pill.isVisible()) {
      const [pillBox] = await pill.evaluateAll(elements => elements.map(element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; }));
      expect(inside(pillBox, cards[i]), `pill ${i}`).toBe(true);
      for (const object of objects) expect(overlaps(pillBox, object), `pill vs object ${i}`).toBe(false);
    }
  }
}

for (const { width, height } of sizes) {
  for (const { label, count, enlarged, stations } of configs) {
    test(`${label} at ${width}x${height}: stations, answers and hub stay inside the stage without overlap`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await startGame(page, { count, enlarged, presets: ['add10', 'add10', 'add10', 'add10'].slice(0, count), url: './?instant' });
      await page.evaluate(() => document.fonts.load('64px "Titan One"').then(() => document.fonts.ready));
      const scale = Math.min(width / 1280, height / 720);
      // The 720p run samples every round (24 questions for 4 players); the large run checks the first round with Help badges shown.
      const rounds = width === 1280 && !enlarged ? 6 : 1;
      for (let round = 1; round <= rounds; round++) {
        await expectLayout(page, stations, scale);
        for (let pupil = 1; pupil <= stations; pupil++) await page.getByRole('button', { name: `Help player ${enlarged ? 1 : pupil}`, exact: true }).click();
        await expectLayout(page, stations, scale);
        if (round < rounds) {
          if (enlarged) await page.getByRole('button', { name: 'Pass player 1', exact: true }).click(); else await passAll(page, count);
          await page.getByRole('button', { name: /^Next (round|player)$/ }).click();
        }
      }
    });
  }
}

test('picture answers stay inside their buttons at 720p', async ({ page }) => {
  await startGame(page, { count: 2, presets: ['add10', 'add10'], pictures: true, url: './?instant' });
  for (let round = 1; round <= 3; round++) {
    const fits = await page.locator('.sp-btn').evaluateAll(buttons => buttons.map(button => {
      const outer = button.getBoundingClientRect(), inner = button.querySelector('.sp-pic')!.getBoundingClientRect();
      const cx = outer.x + outer.width / 2, cy = outer.y + outer.height / 2, radius = outer.width / 2;
      return [[inner.x, inner.y], [inner.right, inner.y], [inner.x, inner.bottom], [inner.right, inner.bottom]].every(([x, y]) => Math.hypot(x - cx, y - cy) <= radius);
    }));
    expect(fits.every(Boolean)).toBe(true);
    await passAll(page, 2);
    await page.getByRole('button', { name: 'Next round' }).click();
  }
});

for (const count of [1, 2, 3, 4]) {
  test(`practice with ${count} pupils fits a 720p window with large targets`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openSetup(page);
    await page.getByLabel('Crew size').selectOption(String(count));
    await page.getByLabel('Keyboard & on-screen buttons').check();
    await page.getByRole('button', { name: 'Enter practice' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const targets = await page.locator('.answer').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(); return box.width >= 96 && box.height >= 96;
    }));
    expect(targets.every(Boolean)).toBe(true);
  });
}
