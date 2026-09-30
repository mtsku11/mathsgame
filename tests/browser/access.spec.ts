import { test, expect } from '@playwright/test';

test('anonymous comfort and input preferences survive reload while a new session starts fresh', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Reduce motion')).toBeChecked();
  await expect(page.getByLabel('Quiet mode')).toBeChecked();
  await page.getByLabel('Less decoration').check();
  await page.getByLabel('Effects volume').selectOption('50');
  await page.getByLabel('Player 1 left key').selectOption('KeyZ');
  await page.getByLabel('Input cooldown').first().selectOption('1000');
  await page.getByLabel('Player 1 maths').selectOption('add10');
  await page.getByLabel('Picture answers for addition').first().check();
  await page.getByLabel('Advance completed rounds automatically').check();
  await page.getByLabel('Celebration delay').selectOption('7');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await expect(page.locator('body')).toHaveClass(/reduce-motion/);
  await expect(page.locator('body')).toHaveClass(/simple/);
  expect(await page.locator('.answer').first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await page.locator('.route').evaluate(element => getComputedStyle(element).visibility)).toBe('hidden');
  await page.reload();
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Player 1 left key')).toHaveValue('KeyZ');
  await expect(page.getByLabel('Input cooldown').first()).toHaveValue('1000');
  await expect(page.getByLabel('Player 1 maths')).toHaveValue('add10');
  await expect(page.getByLabel('Picture answers for addition').first()).toBeChecked();
  await expect(page.getByLabel('Less decoration')).toBeChecked();
  await expect(page.getByLabel('Effects volume')).toHaveValue('50');
  await expect(page.getByLabel('Advance completed rounds automatically')).toBeChecked();
  await expect(page.getByLabel('Celebration delay')).toHaveValue('7');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('number-crew-settings-v1')!));
  expect(Object.keys(saved).sort()).toEqual(['autoAdvance', 'count', 'effectsVolume', 'enlarged', 'players', 'quiet', 'reduced', 'simple', 'transitionSeconds']);
  expect(Object.keys(saved.players[0]).sort()).toEqual(['cooldown', 'keys', 'preset', 'quantities']);
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await expect(page.getByRole('button', { name: 'Check switches in practice' })).toBeDisabled();
  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem('number-crew-settings-v1')!);
    delete legacy.effectsVolume;
    localStorage.setItem('number-crew-settings-v1', JSON.stringify(legacy));
  });
  await page.reload();
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Effects volume')).toHaveValue('100');
  await expect(page.getByLabel('Player 1 left key')).toHaveValue('KeyZ');
});

test('reduced motion keeps cargo and destination progress visible without travel', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Crew size').selectOption('4');
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await page.getByLabel('Reduce motion').check();
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await page.waitForTimeout(150);

  const station = page.locator('.station').first();
  const total = await station.locator('.question-area .dot').count();
  const choices = await station.locator('.answer-value').allTextContents();
  await station.locator('.answer').nth(choices.findIndex(value => Number(value) === total)).click();
  await expect(page.locator('.cargo-bay .cargo-0')).toBeVisible();
  await expect(page.locator('.cargo-flight')).toHaveCount(0);
  expect(await page.locator('.route > .rocket').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');

  for (let pupil = 2; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  for (let pupil = 1; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.locator('.route .planet.revealed')).toHaveCount(1);
  await expect(page.locator('.planet.revealed .planet-reveal')).toBeVisible();
  expect(await page.locator('.planet.revealed .planet-reveal').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
});

test('one stable live region announces the active enlarged turn and feedback', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Crew size').selectOption('4');
  await page.getByLabel('Screen layout').selectOption('enlarged');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();

  const status = page.locator('#game-status');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  await expect(status).toContainText('Player 1.');
  await expect(status).toContainText('Left answer');
  await expect(page.locator('#game-status[aria-live="polite"]')).toHaveCount(1);
  await expect(page.locator('.station-footer > p')).not.toHaveAttribute('role', 'status');

  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect(status).toHaveText('Player 1. Count together for help.');
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await expect(status).toHaveText('Player 1. Travelling with the crew.');
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(status).toContainText('Player 2.');
  await expect(status).toContainText('Left answer');
});

test('quiet play stays silent and teacher can enable and disable local sound', async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    (window as any).createdTones = 0;
    (window as any).gainPeaks = [];
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const node = createGain.call(this);
      const setValue = node.gain.setValueAtTime.bind(node.gain);
      node.gain.setValueAtTime = (value, time) => {
        (window as any).gainPeaks.push(value);
        return setValue(value, time);
      };
      return node;
    };
    AudioContext.prototype.createOscillator = function () {
      (window as any).createdTones++;
      return original.call(this);
    };
  });
  await page.goto('./');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  const answerPlayer = async (index: number) => {
    await page.waitForTimeout(150);
    const station = page.locator('.station').nth(index);
    const total = await station.locator('.question-area .dot').count();
    const values = await station.locator('.answer-value').allTextContents();
    await station.locator('.answer').nth(values.findIndex(value => Number(value) === total)).click();
    await expect(station.locator('.station-footer > p')).toContainText('Cargo ready');
  };
  await answerPlayer(0);
  expect(await page.evaluate(() => (window as any).createdTones)).toBe(0);
  await page.getByRole('button', { name: 'Pause journey' }).click();
  await page.getByRole('button', { name: 'Enable gentle sound' }).click();
  await page.getByLabel('Effects volume').selectOption('50');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await answerPlayer(1);
  expect(await page.evaluate(() => (window as any).createdTones)).toBe(1);
  await page.getByRole('button', { name: 'Pause journey' }).click();
  expect(await page.evaluate(() => (window as any).gainPeaks)).toEqual([0.0175]);
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await page.getByLabel('Effects volume').selectOption('100');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await answerPlayer(2);
  expect(await page.evaluate(() => (window as any).createdTones)).toBe(1);
  await page.getByRole('button', { name: /Next round/ }).click();
  await page.getByRole('button', { name: 'Pause journey' }).click();
  await page.getByRole('button', { name: 'Enable gentle sound' }).click();
  await page.getByLabel('Effects volume').selectOption('0');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await answerPlayer(0);
  expect(await page.evaluate(() => (window as any).createdTones)).toBe(1);
  await page.getByRole('button', { name: 'Pause journey' }).click();
  await page.getByLabel('Effects volume').selectOption('100');
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  await answerPlayer(1);
  expect(await page.evaluate(() => (window as any).gainPeaks)).toEqual([0.0175, 0.035]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 360 }]) {
  test(`teacher controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.getByText('Comfort & access settings', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Screen layout').selectOption('enlarged');
    await page.getByLabel('Keyboard & on-screen buttons').check();
    await page.getByRole('button', { name: 'Enter practice' }).click();
    await page.getByRole('button', { name: 'Launch the journey' }).click();
    await page.getByRole('button', { name: 'Pause journey' }).click();
    const resume = page.getByRole('button', { name: 'Resume journey', exact: true });
    await resume.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Enable gentle sound' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Effects volume')).toBeFocused();
    await page.keyboard.press('Tab');
    const end = page.getByRole('button', { name: 'End journey & return to setup' });
    await expect(end).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(resume).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(end).toBeFocused();
    await end.scrollIntoViewIfNeeded();
    await expect(end).toBeInViewport();
    page.once('dialog', dialog => dialog.accept());
    await end.click();
    await expect(page.getByLabel('Crew size')).toBeVisible();
  });
}
