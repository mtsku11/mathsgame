import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, enlarged = false) {
  await page.goto('./');
  await page.getByLabel('Crew size').selectOption('4');
  if (enlarged) await page.getByLabel('Screen layout').selectOption('enlarged');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);
}
test('four players complete six rounds with teacher support; no console errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  for (let round = 1; round <= 6; round++) {
    await expect(page.getByRole('region', { name: 'Journey progress' }).getByText(`Round ${round} of 6`, { exact: false })).toBeVisible();
    for (let pupil = 1; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
  }
  await expect(page.locator('.result-stars')).toContainText('0 crew stars collected');
  await expect(page.getByText('A whole crew.')).toBeVisible(); expect(errors).toEqual([]);
});
test('cargo reaches the rocket and completed rounds build the expedition', async ({ page }) => {
  await start(page);
  const firstStation = page.locator('.station').first();
  const total = await firstStation.locator('.question-area .dot').count();
  const choices = await firstStation.locator('.answer-value').allTextContents();
  await firstStation.locator('.answer').nth(choices.findIndex(value => Number(value) === total)).click();
  await expect(page.locator('.cargo-bay .cargo-0')).toBeVisible();
  await expect(page.locator('.cargo-flight')).toBeVisible();
  for (let pupil = 2; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.locator('.mission-part.complete')).toHaveCount(1);
  await expect(page.locator('.cargo-flight')).toHaveCount(0);

  for (let round = 2; round <= 6; round++) {
    for (let pupil = 1; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
    await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
    if (round === 2) {
      await expect(page.locator('.mission-part.complete')).toHaveCount(2);
      await expect(page.locator('.route-stop.visited')).toHaveCount(1);
      await expect(page.locator('.route .planet.revealed')).toHaveCount(1);
    }
    if (round === 4) await expect(page.locator('.route-stop.visited')).toHaveCount(2);
  }
  await expect(page.locator('.result-planets .planet.revealed')).toHaveCount(3);
  await expect(page.locator('.result-assembly .mission-part.complete')).toHaveCount(6);
});
test('help does not answer, pause preserves question, blur pauses', async ({ page }) => {
  await start(page);
  const prompt = await page.locator('.station').first().innerText();
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect(page.locator('.scaffold')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next round' })).toBeDisabled();
  await page.getByRole('button', { name: 'Pause journey' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause journey', exact: true })).toBeFocused();
  expect(await page.locator('.station').first().innerText()).toContain(prompt);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toContainText('lost focus');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  const question = await page.locator('.station .question-area').first().innerText();
  const stars = await page.locator('.star-total strong').innerText();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog')).toContainText('page was hidden');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause journey', exact: true })).toBeFocused();
  await expect(page.locator('.station .question-area').first()).toHaveText(question);
  await expect(page.locator('.star-total strong')).toHaveText(stars);
});
test('enlarged turns require teacher advance, small viewport has no horizontal overflow', async ({ page }) => {
  await start(page, true);
  await expect(page.locator('.station')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(page.locator('.station h2')).toContainText('Player 2');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('fresh simultaneous keys affect each pupil without held repeats across a round', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    for (const [key, code] of [['f', 'KeyF'], ['a', 'KeyA'], ['c', 'KeyC'], ['q', 'KeyQ']]) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, code }));
    }
  });
  await page.waitForTimeout(100);
  for (let i = 0; i < 4; i++) await expect(page.locator('.station-footer > p').nth(i)).not.toHaveText('Choose your answer');
  for (let pupil = 1; pupil <= 4; pupil++) await expect(page.locator('#game-status')).toContainText(`Player ${pupil}.`);
  for (let pupil = 1; pupil <= 4; pupil++) { const pass = page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }); if (await pass.isEnabled()) await pass.click(); }
  await page.getByRole('button', { name: 'Next round' }).click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) await expect(page.locator('.station-footer > p').nth(i)).toHaveText('Choose your answer');
});

for (const count of [3, 4]) {
  test(`${count} pupils answer a mixed-maths mission, retry and replay`, async ({ page }) => {
    await page.goto('./');
    await page.getByLabel('Crew size').selectOption(String(count));
    await page.getByLabel('Player 2 maths').selectOption('add5');
    await page.getByLabel('Player 3 maths').selectOption('add10');
    await page.getByLabel('Keyboard & on-screen buttons').check();
    await page.getByRole('button', { name: 'Enter practice' }).click();
    await page.getByRole('button', { name: 'Launch the journey' }).click();
    await page.waitForTimeout(150);
    for (let round = 1; round <= 6; round++) {
      for (let pupil = 0; pupil < count; pupil++) {
        const station = page.locator('.station').nth(pupil);
        const total = await station.locator('.question-area .dot').count();
        const choices = await station.locator('.answer-value').allTextContents();
        const side = choices.findIndex(value => Number(value) === total);
        expect(side).toBeGreaterThanOrEqual(0);
        if (round === 1 && pupil === 0) {
          await station.locator('.answer').nth(1 - side).click();
          await expect(station.locator('.station-footer > p')).toContainText('try again');
          await expect(station.locator('.answer-value')).toHaveText(choices);
          await expect(page.locator('.star-total strong')).toHaveText('0');
          await expect(page.getByRole('button', { name: 'Next round' })).toBeDisabled();
          await page.waitForTimeout(800);
        }
        await station.locator('.answer').nth(side).click();
        await expect(station.locator('.station-footer > p')).toContainText('Cargo ready');
        await expect(station.locator('.answer').first()).toBeDisabled();
        await expect(station.locator('.answer').last()).toBeDisabled();
      }
      await expect(page.locator('.star-total strong')).toHaveText(String(round * count));
      await page.getByRole('button', { name: round === 6 ? 'Finish journey' : 'Next round' }).click();
      // The per-pupil 500 ms cooldown survives round transitions.
      await page.waitForTimeout(600);
    }
    await expect(page.locator('.result-stars')).toContainText(`${6 * count} crew stars collected`);
    await page.getByRole('button', { name: 'Another adventure' }).click();
    await expect(page.getByRole('button', { name: 'Launch the journey' })).toBeVisible();
    await page.getByRole('button', { name: 'Launch the journey' }).click();
    await expect(page.locator('.star-total strong')).toHaveText('0');
    await expect(page.getByRole('region', { name: 'Journey progress' }).getByText('Round 1 of 6', { exact: false })).toBeVisible();
  });
}

test('automatic completed rounds freeze while paused; enlarged turns remain teacher controlled', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Advance completed rounds automatically').check();
  await page.getByLabel('Celebration delay').selectOption('2');
  await page.getByLabel('Screen layout').selectOption('enlarged');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await page.waitForTimeout(2200);
  await expect(page.locator('.station h2')).toContainText('Player 1');
  await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'Pass player 3', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pause journey', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Journey progress' }).getByText('Round 1 of 6', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Journey progress' }).getByText('Round 2 of 6', { exact: false })).toBeVisible();
  await expect(page.locator('.station h2')).toContainText('Player 1');
});
