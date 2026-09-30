import { test, expect, type Page } from '@playwright/test';
import { answerCorrectly, choices, nextButton, passAll, startGame, station, wrongSide } from '../helpers';

const journey = (page: Page) => page.getByRole('region', { name: 'Journey progress' });
const crewStars = (page: Page) => page.locator('.sp-core-num');
const nextName = (round: number) => round === 6 ? 'Finish journey' : 'Next round';

test('four players complete six rounds with teacher support; no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await startGame(page);
  for (let round = 1; round <= 6; round++) {
    await expect(journey(page).getByText(`Round ${round} of 6`, { exact: false })).toBeVisible();
    await expect(nextButton(page)).toBeHidden();
    for (let pupil = 1; pupil <= 3; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
    await expect(nextButton(page)).toBeHidden();
    await page.getByRole('button', { name: 'Pass player 4', exact: true }).click();
    await nextButton(page, nextName(round)).click();
  }
  await expect(page.locator('.sp-fin-stars')).toContainText('0 crew stars collected');
  await expect(page.getByRole('heading', { name: 'Mission complete!', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('stars join the mothership and completed rounds fill the journey', async ({ page }) => {
  await startGame(page);
  await expect(page.locator('.sp-dest-name')).toHaveText('Golden Rings');
  await answerCorrectly(page, 0);
  await expect(crewStars(page)).toHaveText('1');
  await expect(page.getByRole('img', { name: 'Crew stars: 1' })).toBeVisible();
  await expect(station(page, 0)).toHaveClass(/is-done/);
  await expect(page.locator('.sp-beam.is-done')).toHaveCount(1);
  await expect(page.locator('.sp-pip.is-done')).toHaveCount(0);
  for (let pupil = 2; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.locator('.sp-pip.is-done')).toHaveCount(1);
  await expect(page.locator('.sp-pip.is-current')).toHaveCount(1);
  await expect(page.locator('.sp-beam.is-done')).toHaveCount(0);
  await expect(crewStars(page)).toHaveText('1');

  for (let round = 2; round <= 6; round++) {
    await passAll(page, 4);
    await nextButton(page, nextName(round)).click();
    if (round === 2) {
      await expect(page.locator('.sp-pip.is-done')).toHaveCount(2);
      await expect(page.locator('.sp-stop.is-visited')).toHaveCount(1);
      await expect(page.locator('.sp-stop.is-visited .sr-only')).toHaveText('Golden Rings, visited');
      await expect(page.locator('.sp-stop.is-current .sr-only')).toHaveText('Candy Planet, current destination');
      await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
    }
    if (round === 4) {
      await expect(page.locator('.sp-stop.is-visited')).toHaveCount(2);
      await expect(page.locator('.sp-dest-name')).toHaveText('Frosty Moon');
    }
  }
  await expect(page.locator('.sp-fin-route li')).toHaveCount(3);
  await expect(page.locator('.sp-fin-pips .sp-pip.is-done')).toHaveCount(6);
});

test('help does not answer, pause preserves question, blur pauses', async ({ page }) => {
  await startGame(page);
  const first = station(page, 0);
  const before = await first.evaluate(element => element.querySelector('.sp-prompt')!.textContent! + element.querySelector('.sp-objs')!.getAttribute('aria-label'));
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect(first).toHaveClass(/is-helped/);
  await expect(first.locator('.sp-badge').first()).toBeVisible();
  await expect(first.locator('.sp-pill')).toHaveText('Count with me');
  await expect(crewStars(page)).toHaveText('0');
  await expect(nextButton(page)).toBeHidden();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Journey paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toBeFocused();
  const after = () => first.evaluate(element => element.querySelector('.sp-prompt')!.textContent! + element.querySelector('.sp-objs')!.getAttribute('aria-label'));
  expect(await after()).toBe(before);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toContainText('lost focus');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog')).toContainText('page was hidden');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toBeFocused();
  expect(await after()).toBe(before);
  await expect(first).toHaveClass(/is-helped/);
  await expect(crewStars(page)).toHaveText('0');
});

test('Escape pauses and Enter or N advance only a ready round', async ({ page }) => {
  await startGame(page, { count: 2 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await page.keyboard.press('n');
  await expect(journey(page).getByText('Round 1 of 6', { exact: false })).toBeVisible();
  await passAll(page, 2);
  await expect(nextButton(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(journey(page).getByText('Round 2 of 6', { exact: false })).toBeVisible();
  await passAll(page, 2);
  await page.keyboard.press('n');
  await expect(journey(page).getByText('Round 3 of 6', { exact: false })).toBeVisible();
  await expect(nextButton(page)).toBeHidden();
});

test('enlarged turns require teacher advance, small viewport has no horizontal overflow', async ({ page }) => {
  await startGame(page, { enlarged: true });
  await expect(page.locator('.sp-st')).toHaveCount(1);
  await expect(station(page, 0)).toHaveAttribute('aria-label', 'Player 1');
  await expect(page.locator('.sp-turn')).toHaveText('Player 1 of 4');
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(station(page, 0)).toHaveAttribute('aria-label', 'Player 2');
  await expect(page.locator('.sp-turn')).toHaveText('Player 2 of 4');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fresh simultaneous keys affect each pupil without held repeats across a round', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    for (const [key, code] of [['f', 'KeyF'], ['a', 'KeyA'], ['c', 'KeyC'], ['q', 'KeyQ']]) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, code }));
    }
  });
  await page.waitForTimeout(100);
  for (let i = 0; i < 4; i++) await expect(station(page, i).locator('.sp-pill')).toBeVisible();
  for (let pupil = 1; pupil <= 4; pupil++) await expect(page.locator('#game-status')).toContainText(`Player ${pupil}.`);
  for (let pupil = 1; pupil <= 4; pupil++) { const pass = page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }); if (await pass.isEnabled()) await pass.click(); }
  await page.getByRole('button', { name: 'Next round' }).click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) await expect(station(page, i).locator('.sp-pill')).toBeHidden();
  await expect(page.locator('.sp-btn.is-ready')).toHaveCount(8);
});

test('answer states: try keeps both answers available, correct dims the other, pass rests', async ({ page }) => {
  await startGame(page, { count: 3 });
  const first = station(page, 0);
  const before = await choices(first);
  await first.locator('.sp-btn').nth(await wrongSide(first)).click();
  await expect(first.locator('.sp-pill')).toHaveText('Try again');
  await expect(first.locator('.sp-btn.is-try')).toHaveCount(1);
  await expect(first.locator('.sp-btn:disabled')).toHaveCount(0);
  await expect(first.locator('.sp-pilot')).toHaveAttribute('data-mood', 'think');
  expect(await choices(first)).toEqual(before);
  await page.waitForTimeout(700);
  await answerCorrectly(page, 0);
  await expect(first.locator('.sp-btn.is-right')).toHaveCount(1);
  await expect(first.locator('.sp-btn.is-dim')).toHaveCount(1);
  await expect(first.locator('.sp-btn:disabled')).toHaveCount(2);
  await expect(first.locator('.sp-pilot')).toHaveAttribute('data-mood', 'cheer');
  await expect(page.locator('#game-status')).toContainText('Player 1. Star sent.');
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  const second = station(page, 1);
  await expect(second.locator('.sp-pill')).toHaveText('With the crew');
  await expect(second.locator('.sp-btn.is-dim')).toHaveCount(2);
  await expect(second.locator('.sp-btn:disabled')).toHaveCount(2);
  await expect(second.locator('.sp-pilot')).toHaveAttribute('data-mood', 'wave-right');
  await expect(crewStars(page)).toHaveText('1');
});

test('picture answers show star clusters while accessible names stay numeric', async ({ page }) => {
  await startGame(page, { count: 2, presets: ['add10', 'add10'], pictures: true });
  for (const index of [0, 1]) {
    const target = station(page, index);
    await expect(target.locator('.sp-btn .sp-pic')).toHaveCount(2);
    expect(await choices(target)).toHaveLength(2);
    expect(await target.locator('.sp-val').evaluateAll(values => values.map(value => value.textContent))).toEqual(['', '']);
    await expect(target.locator('.sp-prompt')).toContainText('=');
  }
});

for (const count of [3, 4]) {
  test(`${count} pupils answer a mixed-maths mission, retry and replay`, async ({ page }) => {
    await startGame(page, { count, presets: ['count', 'add5', 'add10'] });
    for (let round = 1; round <= 6; round++) {
      for (let pupil = 0; pupil < count; pupil++) {
        const target = station(page, pupil);
        if (round === 1 && pupil === 0) {
          const before = await choices(target);
          await target.locator('.sp-btn').nth(await wrongSide(target)).click();
          await expect(target.locator('.sp-pill')).toHaveText('Try again');
          expect(await choices(target)).toEqual(before);
          await expect(crewStars(page)).toHaveText('0');
          await expect(nextButton(page)).toBeHidden();
          await page.waitForTimeout(800);
        }
        await answerCorrectly(page, pupil);
        await expect(target.locator('.sp-btn').first()).toBeDisabled();
        await expect(target.locator('.sp-btn').last()).toBeDisabled();
      }
      await expect(crewStars(page)).toHaveText(String(round * count));
      await page.getByRole('button', { name: nextName(round) }).click();
      // The per-pupil 500 ms cooldown survives round transitions.
      await page.waitForTimeout(600);
    }
    await expect(page.locator('.sp-fin-stars')).toContainText(`${6 * count} crew stars collected`);
    await page.getByRole('button', { name: 'Another adventure' }).click();
    await expect(page.getByRole('button', { name: 'Launch the journey' })).toBeVisible();
    await page.getByRole('button', { name: 'Launch the journey' }).click();
    await expect(crewStars(page)).toHaveText('0');
    await expect(journey(page).getByText('Round 1 of 6', { exact: false })).toBeVisible();
  });
}

for (const count of [1, 2]) {
  test(`${count} player${count > 1 ? 's' : ''} answer six rounds and see only their own stations`, async ({ page }) => {
    await startGame(page, { count });
    await expect(page.locator('.sp-st')).toHaveCount(count);
    for (let round = 1; round <= 6; round++) {
      for (let pupil = 0; pupil < count; pupil++) await answerCorrectly(page, pupil);
      await expect(crewStars(page)).toHaveText(String(round * count));
      await page.getByRole('button', { name: nextName(round) }).click();
      await page.waitForTimeout(600);
    }
    await expect(page.locator('.sp-fin-stars')).toContainText(`${6 * count} crew stars collected`);
  });
}

test('automatic completed rounds freeze while paused; enlarged turns remain teacher controlled', async ({ page }) => {
  await startGame(page, { count: 3, enlarged: true, autoAdvance: 2 });
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.waitForTimeout(2200);
  await expect(station(page, 0)).toHaveAttribute('aria-label', 'Player 1');
  await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'Pass player 3', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(journey(page).getByText('Round 1 of 6', { exact: false })).toBeVisible();
  await expect(journey(page).getByText('Round 2 of 6', { exact: false })).toBeVisible();
  await expect(station(page, 0)).toHaveAttribute('aria-label', 'Player 1');
});
