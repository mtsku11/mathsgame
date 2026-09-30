import { test, expect } from '@playwright/test';
import { openSetup, enterSetup, answerCorrectly, nextButton, passAll, startGame, station } from '../helpers';

test('anonymous comfort and input preferences survive reload while a new session starts fresh', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSetup(page);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Reduce motion')).toBeChecked();
  await expect(page.getByLabel('Quiet mode')).not.toBeChecked();
  await page.getByLabel('Less decoration').check();
  await page.getByLabel('Effects volume').selectOption('50');
  await page.getByLabel('Player 1 left key').selectOption('KeyZ');
  await page.getByLabel('Input cooldown').first().selectOption('1000');
  await page.getByLabel('Player 1 maths').selectOption('add10');
  await page.getByLabel('Picture answers for addition').first().check();
  await page.getByLabel('Advance completed rounds automatically').check();
  await page.getByLabel('Celebration delay').selectOption('7');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.locator('html')).toHaveClass(/nc-reduced/);
  await expect(page.locator('body')).toHaveClass(/simple/);
  expect(await page.locator('.ck-cap').first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await page.locator('.sp-deco').first().evaluate(element => getComputedStyle(element).visibility)).toBe('hidden');
  await page.reload();
  await enterSetup(page);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Player 1 left key')).toHaveValue('KeyZ');
  await expect(page.getByLabel('Input cooldown').first()).toHaveValue('1000');
  await expect(page.getByLabel('Player 1 maths')).toHaveValue('add10');
  await expect(page.getByLabel('Picture answers for addition').first()).toBeChecked();
  await expect(page.getByLabel('Less decoration')).toBeChecked();
  await expect(page.getByLabel('Effects volume')).toHaveValue('50');
  await expect(page.getByLabel('Advance completed rounds automatically')).toBeChecked();
  await expect(page.getByLabel('Celebration delay')).toHaveValue('7');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('number-crew-settings-v2')!));
  expect(Object.keys(saved).sort()).toEqual(['autoAdvance', 'boost', 'count', 'effectsVolume', 'enlarged', 'lowStim', 'musicVolume', 'narration', 'players', 'quality', 'quiet', 'reduced', 'simple', 'transitionSeconds', 'voiceVolume']);
  expect(Object.keys(saved.players[0]).sort()).toEqual(['boostPower', 'caps', 'cooldown', 'keys', 'preset', 'quantities']);
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeDisabled();
  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem('number-crew-settings-v2')!);
    delete legacy.effectsVolume;
    localStorage.setItem('number-crew-settings-v2', JSON.stringify(legacy));
  });
  await page.reload();
  await enterSetup(page);
  await page.getByText('Comfort & access settings', { exact: true }).click();
  await expect(page.getByLabel('Effects volume')).toHaveValue('75');
  await expect(page.getByLabel('Player 1 left key')).toHaveValue('KeyZ');
});

test('reduced motion keeps stars and destination progress visible without travel or idle loops', async ({ page }) => {
  await startGame(page, { reduced: true });
  await expect(page.locator('html')).toHaveClass(/nc-reduced/);
  await answerCorrectly(page, 0);
  await expect(page.locator('.sp-core-num')).toHaveText('1');
  await expect(station(page, 0)).toHaveClass(/is-done/);
  await expect(station(page, 0).locator('.sp-pill')).toHaveText('Star sent!');
  await page.waitForTimeout(400);
  expect(await page.locator('.sp-bob').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === 'none'))).toBe(true);
  const ready = station(page, 1).locator('.sp-btn.is-ready').first();
  expect(await ready.evaluate(element => ({ ring: getComputedStyle(element, '::after').animationName, glow: getComputedStyle(element, '::after').opacity, transition: getComputedStyle(element).transitionDuration })))
    .toEqual({ ring: 'none', glow: '0.5', transition: '0s' });
  for (const selector of ['.sp-beam', '.sp-ship', '.sp-dest-planet .sp-planet', '.sp-tw']) {
    expect(await page.locator(selector).first().evaluate(element => getComputedStyle(element).animationName), selector).toBe('none');
  }

  for (let pupil = 2; pupil <= 4; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
  await page.getByRole('button', { name: 'Next round' }).click();
  await passAll(page, 4);
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(page.locator('.sp-stop.is-visited')).toHaveCount(1);
  await expect(page.locator('.sp-stop.is-visited .sp-vstar')).toBeVisible();
  await expect(page.locator('.sp-stop.is-current .sr-only')).toHaveText('Candy Planet, current destination');
  await expect(page.locator('.sp-pip.is-done')).toHaveCount(2);
});

test('one stable live region announces the active enlarged turn and feedback', async ({ page }) => {
  await startGame(page, { enlarged: true });
  const status = page.locator('#game-status');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  await expect(status).toContainText('Player 1.');
  await expect(status).toContainText('Left answer');
  await expect(page.locator('#game-status[aria-live="polite"]')).toHaveCount(1);
  await expect(page.locator('[aria-live]')).toHaveCount(1);
  await expect(page.locator('[role="status"]')).toHaveCount(1);
  await expect(page.locator('.sp-pill')).not.toHaveAttribute('role', 'status');

  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await expect(status).toHaveText('Player 1. Count together for help.');
  await page.getByRole('button', { name: 'Pass player 1', exact: true }).click();
  await expect(status).toHaveText('Player 1. Travelling with the crew.');
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(status).toContainText('Player 2.');
  await expect(status).toContainText('Left answer');
});

test('quiet play stays silent and teacher can enable and disable local sound', async ({ page }) => {
  // Answer sounds are the 'press' effect (sprite gain 0.6) at the effects volume; the volume preview plays a 'correct' chime, so 'press' counts only answers.
  const presses = async (): Promise<number[]> => (await page.evaluate(() => (window as any).__NC_AUDIO__.log as { channel: string; action: string; id: string; volume: number }[]))
    .filter(entry => entry.channel === 'sfx' && entry.action === 'play' && entry.id === 'press').map(entry => Number(entry.volume.toFixed(3)));
  const anything = async (): Promise<number> => (await page.evaluate(() => (window as any).__NC_AUDIO__.log as { action: string }[])).filter(entry => entry.action === 'play').length;
  const answerPlayer = async (index: number) => {
    await page.waitForTimeout(150);
    await answerCorrectly(page, index);
  };
  const pauseWith = async (name: string, volume?: string) => {
    await page.getByRole('button', { name: 'Pause game' }).click();
    if (name) await page.getByRole('button', { name }).click();
    if (volume) await page.getByLabel('Effects volume').selectOption(volume);
    await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  };
  await startGame(page, { count: 3, quiet: true, url: './?silentaudio' });
  await page.evaluate(() => (window as any).__NC_AUDIO__.clear());
  await answerPlayer(0);
  expect(await anything()).toBe(0);
  await pauseWith('Enable gentle sound', '50');
  await answerPlayer(1);
  expect(await presses()).toEqual([0.3]);
  await pauseWith('Turn sound off', '100');
  const before = await anything();
  await answerPlayer(2);
  expect(await anything()).toBe(before);
  await nextButton(page).click();
  await pauseWith('Enable gentle sound', '0');
  await answerPlayer(0);
  expect(await presses()).toEqual([0.3]);
  await pauseWith('', '100');
  await answerPlayer(1);
  expect(await presses()).toEqual([0.3, 0.6]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 360 }]) {
  test(`teacher controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSetup(page);
    await page.getByText('Comfort & access settings', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Screen layout').selectOption('enlarged');
    await page.getByLabel('Keyboard & on-screen buttons').check();
    await page.getByRole('button', { name: 'Start crew check-in' }).click();
    await page.getByRole('button', { name: 'Start anyway' }).click();
    await page.getByRole('button', { name: 'Pause game' }).click();
    const resume = page.getByRole('button', { name: 'Resume journey', exact: true });
    await resume.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Turn sound off' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Effects volume')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Music volume')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Voice volume')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Voice narration')).toBeFocused();
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
