import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { correctSide, installXac, nextButton, openSetup, passAll, pupilKeys, setBoost, setButtons, setConnected, station, tapKey } from '../helpers';

const shots = 'test-results/redesign/phase5';
const serious = async (page: Page): Promise<string[]> => (await new AxeBuilder({ page }).analyze()).violations
  .filter(violation => violation.impact === 'serious' || violation.impact === 'critical').map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`);
const errorsOf = (page: Page): string[] => { const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); return errors; };
const tap = async (page: Page, buttons: number[], ms = 150): Promise<void> => { await setButtons(page, buttons); await page.waitForTimeout(ms); await setButtons(page, []); await page.waitForTimeout(ms); };
const pill = (page: Page, player: number) => page.locator('.ck-card').nth(player).locator('.ck-pill');

// Learns every switch on the simulated XAC (button n is the n-th slot).
async function learn(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count * 2; i++) {
    await page.locator('.map-button').nth(i).click();
    await page.waitForTimeout(150);
    await tap(page, [i]);
    await expect(page.locator('.map-button').nth(i)).toContainText('checked');
  }
}
async function checkIn(page: Page, count: number): Promise<void> {
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.locator('.ck-card')).toHaveCount(count);
  await page.waitForTimeout(500);
  await tap(page, Array.from({ length: count }, (_, i) => i * 2), 200);
  await page.waitForTimeout(400);
  await tap(page, Array.from({ length: count }, (_, i) => i * 2 + 1), 200);
}
async function toSwitchSetup(page: Page, count: number): Promise<void> {
  await installXac(page);
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption(String(count));
  await setBoost(page, false);
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await expect(page.getByRole('heading', { name: 'Match each switch to its pilot' })).toBeVisible();
}
const keysCheckIn = async (page: Page, pupils: number[], sides: number[] = [0, 1]): Promise<void> => {
  for (const side of sides) {
    for (const pupil of pupils) { await tapKey(page, pupil, side, 80); await page.waitForTimeout(120); }
    await page.waitForTimeout(650);
  }
};

for (const count of [1, 4]) {
  test(`controller flow with ${count} pupil${count === 1 ? '' : 's'}: title, setup, switch map, check-in, a round, pause, finish`, async ({ page }) => {
    test.setTimeout(90000);
    const errors = errorsOf(page);
    await installXac(page);
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Get the crew ready', level: 1 })).toBeVisible();
    expect(await serious(page), 'teacher setup').toEqual([]);
    await page.getByLabel('Crew size').selectOption(String(count));
    await setBoost(page, false);
    await page.getByRole('button', { name: 'Set up the switches' }).click();

    await expect(page.locator('.sw-card')).toHaveCount(count);
    await expect(page.locator('.map-button')).toHaveCount(count * 2);
    await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeDisabled();
    // Live press lights: a bound switch lights while it is down and goes out on release.
    await page.locator('.map-button').first().click();
    await page.waitForTimeout(150);
    await tap(page, [0]);
    await expect(page.locator('.map-button').first()).toContainText('Button 0 · checked');
    await setButtons(page, [0]);
    await expect(page.locator('.map-button').first()).toHaveClass(/is-on/);
    await expect(page.locator('.map-button').first().locator('.sw-chip')).toHaveText('PRESSED');
    await setButtons(page, []);
    await expect(page.locator('.map-button').first()).not.toHaveClass(/is-on/);
    for (let i = 1; i < count * 2; i++) {
      await page.locator('.map-button').nth(i).click();
      await page.waitForTimeout(150);
      await tap(page, [i]);
      await expect(page.locator('.map-button').nth(i)).toContainText('checked');
    }
    await expect(page.locator('.sw-slot.is-bound')).toHaveCount(count * 2);
    await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeEnabled();
    expect(await serious(page), 'switch setup').toEqual([]);

    await page.getByRole('button', { name: 'Start crew check-in' }).click();
    await expect(page.locator('.ck-card')).toHaveCount(count);
    for (let i = 0; i < count; i++) await expect(pill(page, i)).toContainText('Sleeping');
    await expect(page.getByRole('button', { name: 'Start mission' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start anyway' })).toBeVisible();
    await page.waitForTimeout(500);
    await tap(page, Array.from({ length: count }, (_, i) => i * 2), 200);
    for (let i = 0; i < count; i++) await expect(pill(page, i)).toHaveText('Now the right switch');
    await page.waitForTimeout(400);
    await tap(page, Array.from({ length: count }, (_, i) => i * 2 + 1), 200);
    for (let i = 0; i < count; i++) await expect(pill(page, i)).toHaveText('Ready!');
    await expect(page.locator('#ck-count')).toHaveText(`${count} of ${count} pilots ready`);
    await expect(page.getByRole('button', { name: 'Start anyway' })).toBeHidden();
    expect(await serious(page), 'crew check-in').toEqual([]);
    await page.getByRole('button', { name: 'Start mission' }).click();

    await expect(page.locator('.sp-st')).toHaveCount(count);
    await page.waitForTimeout(500);
    for (let i = 0; i < count; i++) await tap(page, [i * 2 + await correctSide(station(page, i))], 200);
    for (let i = 0; i < count; i++) await expect(station(page, i).locator('.sp-pill')).toHaveText('Star sent!');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await serious(page), 'pause overlay').toEqual([]);
    await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.keyboard.press('Escape');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'End journey & return to setup' }).click();
    await expect(page.getByLabel('Crew size')).toBeVisible();
    await page.getByRole('button', { name: 'Set up the switches' }).click();
    await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('keyboard flow: check-in with each pupil\'s keys, Enter starts, whole mission, replay returns to check-in, new session returns to setup', async ({ page }) => {
  test.setTimeout(120000);
  const errors = errorsOf(page);
  await page.goto('./?instant');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Crew size').selectOption('3');
  await setBoost(page, false);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await expect(page.getByRole('button', { name: 'Set up the switches' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.getByRole('button', { name: 'Start mission' })).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ck-card')).toHaveCount(3);
  await page.waitForTimeout(400);
  await keysCheckIn(page, [0], [0]);
  await expect(pill(page, 0)).toHaveText('Now the right switch');
  await keysCheckIn(page, [0, 1, 2], [0, 1]);
  await expect(page.locator('#ck-count')).toHaveText('3 of 3 pilots ready');
  await expect(page.locator('.ck-card.is-ready')).toHaveCount(3);
  expect(await serious(page), 'crew check-in (keyboard)').toEqual([]);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await expect(page.locator('.sp-st')).toHaveCount(3);
  for (let round = 1; round <= 6; round++) {
    await passAll(page, 3);
    await nextButton(page).click();
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await page.locator('.sp-fin-summary summary').click();
  const rows = await page.locator('.sp-fin-summary tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(cell => cell.textContent)));
  expect(rows).toEqual([['Player 1 · Pink pilot', '0', '0', '0', '6'], ['Player 2 · Blue pilot', '0', '0', '0', '6'], ['Player 3 · Orange pilot', '0', '0', '0', '6']]);
  await expect(page.locator('.sp-fin-summary')).not.toContainText(/rank|winner|best|fastest|boost|press/i);

  await page.getByRole('button', { name: 'Another adventure' }).click();
  await expect(page.getByRole('heading', { name: 'Crew check!' })).toBeVisible();
  await expect(page.locator('.ck-card')).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(pill(page, i)).toContainText('Sleeping');
  await expect(page.getByRole('button', { name: 'Start mission' })).toBeDisabled();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(page.locator('.sp-st')).toHaveCount(3);
  for (let round = 1; round <= 6; round++) { await passAll(page, 3); await nextButton(page).click(); }
  await page.getByRole('button', { name: 'New session' }).click();
  await expect(page.getByRole('heading', { name: 'Get the crew ready' })).toBeVisible();
  await expect(page.getByLabel('Crew size')).toHaveValue('3');
  expect(errors).toEqual([]);
});

test('starting with pilots still asleep is an explicit teacher action, and Enter does nothing until everyone is ready', async ({ page }) => {
  await page.goto('./?instant');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Crew size').selectOption('2');
  await setBoost(page, false);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(400);
  await keysCheckIn(page, [0]);
  await expect(page.locator('#ck-count')).toHaveText('1 of 2 pilots ready');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await page.keyboard.press('n');
  await page.waitForTimeout(200);
  await expect(page.locator('.ck-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Start mission' })).toBeDisabled();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(page.locator('.sp-st')).toHaveCount(2);
});

test('on-screen buttons check a switch in keyboard mode too', async ({ page }) => {
  await page.goto('./?instant');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Crew size').selectOption('1');
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Player 1, left switch' }).click();
  await expect(page.getByRole('button', { name: 'Player 1, left switch, checked' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Player 1, right switch' }).click();
  await expect(pill(page, 0)).toHaveText('Ready!');
});

test('a duplicate switch cannot be learned twice', async ({ page }) => {
  await toSwitchSetup(page, 2);
  await page.locator('.map-button').nth(0).click();
  await page.waitForTimeout(150);
  await tap(page, [0]);
  await expect(page.locator('.map-button').nth(0)).toContainText('checked');
  await page.locator('.map-button').nth(1).click();
  await page.waitForTimeout(150);
  await setButtons(page, [0]);
  await expect(page.locator('#calibration-status')).toContainText('already assigned');
  await expect(page.locator('.map-button').nth(1)).not.toContainText('checked');
  await setButtons(page, []);
  await page.waitForTimeout(300);
  await tap(page, [1]);
  await expect(page.locator('.map-button').nth(1)).toContainText('Button 1 · checked');
});

test('a switch held down when check-in opens does not check until it has been released and pressed again', async ({ page }) => {
  await toSwitchSetup(page, 1);
  await learn(page, 1);
  await setButtons(page, [0]);
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(900);
  await expect(pill(page, 0)).toContainText('Sleeping');
  await setButtons(page, []);
  await page.waitForTimeout(700);
  await expect(pill(page, 0)).toContainText('Sleeping');
  await tap(page, [0], 200);
  await expect(pill(page, 0)).toHaveText('Now the right switch');
});

test('a held switch is not checked until it is released', async ({ page }) => {
  await toSwitchSetup(page, 1);
  await learn(page, 1);
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(500);
  await setButtons(page, [0]);
  await page.waitForTimeout(800);
  await expect(pill(page, 0)).toHaveText('Hello!');
  await expect(page.getByRole('button', { name: 'Player 1, left switch' })).toBeVisible();
  await setButtons(page, []);
  await expect(pill(page, 0)).toHaveText('Now the right switch');
});

test('controller flow: replay keeps the switches and returns to check-in; a new session needs them learned again', async ({ page }) => {
  test.setTimeout(120000);
  await toSwitchSetup(page, 2);
  await learn(page, 2);
  await checkIn(page, 2);
  await page.getByRole('button', { name: 'Start mission' }).click();
  for (let round = 1; round <= 6; round++) { await passAll(page, 2); await nextButton(page).click(); }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'Another adventure' }).click();
  await expect(page.getByRole('heading', { name: 'Crew check!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start mission' })).toBeDisabled();
  await page.waitForTimeout(500);
  await tap(page, [0, 2], 200);
  await page.waitForTimeout(400);
  await tap(page, [1, 3], 200);
  await expect(page.locator('#ck-count')).toHaveText('2 of 2 pilots ready');
  await page.getByRole('button', { name: 'Start mission' }).click();
  for (let round = 1; round <= 6; round++) { await passAll(page, 2); await nextButton(page).click(); }
  await page.getByRole('button', { name: 'New session' }).click();
  await expect(page.getByLabel('Crew size')).toBeVisible();
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await expect(page.locator('.sw-slot.is-bound')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start crew check-in' })).toBeDisabled();
});

test('unplugging the controller during check-in returns to switch setup, and mid-mission keeps the paused game', async ({ page }) => {
  await toSwitchSetup(page, 1);
  await learn(page, 1);
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.locator('.ck-card')).toHaveCount(1);
  await setConnected(page, false);
  await expect(page.getByRole('heading', { name: 'Match each switch to its pilot' })).toBeVisible();
  await expect(page.locator('.sw-slot.is-bound')).toHaveCount(0);
  await setConnected(page, true);
  await page.waitForTimeout(300);
  await learn(page, 1);
  await checkIn(page, 1);
  await page.getByRole('button', { name: 'Start mission' }).click();
  await expect(page.locator('.sp-st')).toHaveCount(1);
  await setConnected(page, false);
  await expect(page.getByRole('dialog')).toContainText('disconnected');
  await setConnected(page, true);
  await page.getByRole('button', { name: 'Reconnect & check switches' }).click();
  await expect(page.getByRole('button', { name: '← Back to paused game' })).toBeVisible();
  await page.getByRole('button', { name: '← Back to paused game' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('audio: check-in speaks the crew check, the boop and wake effects and the ready and go lines', async ({ page }) => {
  await page.goto('./?silentaudio');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Crew size').selectOption('1');
  await setBoost(page, false);
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { state(): { ready: boolean } } }).__NC_AUDIO__.state().ready)).toBe(true);
  await page.evaluate(() => (window as unknown as { __NC_AUDIO__: { clear(): void } }).__NC_AUDIO__.clear());
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(300);
  await keysCheckIn(page, [0]);
  await page.getByRole('button', { name: 'Start mission' }).click();
  const played = await page.evaluate(() => (window as unknown as { __NC_AUDIO__: { log: { channel: string; action: string; id: string }[] } }).__NC_AUDIO__.log.filter(entry => entry.action === 'play').map(entry => `${entry.channel}:${entry.id}`));
  expect(played).toEqual(expect.arrayContaining(['voice:crew_check', 'sfx:boop', 'sfx:wake', 'voice:ready']));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { log: { action: string; id: string }[] } }).__NC_AUDIO__.log.some(entry => entry.action === 'play' && entry.id === 'lets_go'))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __NC_AUDIO__: { state(): { music: { id: string | null } } } }).__NC_AUDIO__.state().music.id)).toBe('mission');
});

test('title music carries on through teacher setup, switch setup and check-in without restarting', async ({ page }) => {
  await installXac(page);
  await page.goto('./?silentaudio');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __NC_AUDIO__: { state(): { music: { id: string | null } } } }).__NC_AUDIO__.state().music.id)).toBe('title');
  await page.getByLabel('Crew size').selectOption('1');
  await setBoost(page, false);
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await learn(page, 1);
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await expect(page.locator('.ck-card')).toHaveCount(1);
  const plays = await page.evaluate(() => (window as unknown as { __NC_AUDIO__: { log: { channel: string; action: string; id: string }[] } }).__NC_AUDIO__.log.filter(entry => entry.channel === 'music' && entry.action === 'play' && entry.id === 'title').length);
  expect(plays).toBe(1);
});

test.describe('teacher setup at 200% zoom', () => {
  test.use({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  test('every control is reachable by keyboard and inside the window width', async ({ page }) => {
    await openSetup(page);
    await page.getByLabel('Crew size').selectOption('4');
    await page.getByText('Comfort & access settings', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const total = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tp button, .tp select, .tp input, .tp summary')].filter(element => !element.hidden && element.getClientRects().length && !(element instanceof HTMLInputElement && element.type === 'radio' && !element.checked)).length);
    expect(total).toBeGreaterThan(40);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const seen = new Set<string>();
    for (let step = 0; step < total + 5; step++) {
      await page.keyboard.press('Tab');
      const at = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const box = element.getBoundingClientRect();
        return { id: [...document.querySelectorAll('.tp button, .tp select, .tp input, .tp summary')].indexOf(element), left: box.left, right: box.right, scrollX: window.scrollX, width: innerWidth };
      });
      if (at.id < 0) continue;
      seen.add(String(at.id));
      expect(at.left, `control ${at.id} left edge`).toBeGreaterThanOrEqual(-1);
      expect(at.right, `control ${at.id} right edge`).toBeLessThanOrEqual(at.width + 1);
      expect(at.scrollX).toBe(0);
    }
    expect(seen.size).toBe(total);
    expect(await serious(page)).toEqual([]);
  });
});

for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`screenshots at ${size.width}x${size.height}`, async ({ browser }) => {
    test.setTimeout(150000);
    mkdirSync(shots, { recursive: true });
    const context = await browser.newContext({ viewport: size, baseURL: 'http://127.0.0.1:4173/' });
    const page = await context.newPage();
    const suffix = `${size.width}x${size.height}`;
    const shot = async (name: string): Promise<void> => { await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; }); await page.screenshot({ path: `${shots}/${name}-${suffix}.png` }); };
    await installXac(page);
    await page.goto('./');
    await page.waitForTimeout(1800);
    await shot('title');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByLabel('Crew size').selectOption('4');
    await page.getByLabel('Player 2 maths').selectOption('add5');
    await page.getByLabel('Player 3 maths').selectOption('add10');
    await page.waitForTimeout(300);
    await shot('setup');
    await page.getByText('Comfort & access settings', { exact: true }).click();
    await page.screenshot({ path: `${shots}/setup-full-${suffix}.png`, fullPage: true });
    await page.getByText('Comfort & access settings', { exact: true }).click();
    await setBoost(page, false);

    await page.getByLabel('Crew size').selectOption('1');
    await page.getByRole('button', { name: 'Set up the switches' }).click();
    await learn(page, 1);
    await setButtons(page, [0]);
    await page.waitForTimeout(250);
    await shot('switches-1');
    await setButtons(page, []);
    await page.locator('.tp-back').click();
    await page.getByLabel('Crew size').selectOption('4');
    await page.getByRole('button', { name: 'Set up the switches' }).click();
    await learn(page, 3);
    await setButtons(page, [2]);
    await page.waitForTimeout(250);
    await shot('switches-4');
    await setButtons(page, []);
    await page.locator('.map-button').nth(6).click();
    await page.waitForTimeout(150);
    await tap(page, [6]);
    await page.locator('.map-button').nth(7).click();
    await page.waitForTimeout(150);
    await tap(page, [7]);
    await page.getByRole('button', { name: 'Start crew check-in' }).click();
    await page.waitForTimeout(900);
    await shot('checkin-asleep');
    await tap(page, [0, 2], 200);
    await page.waitForTimeout(700);
    await tap(page, [1], 200);
    await tap(page, [4], 200);
    await page.waitForTimeout(700);
    await shot('checkin-partly');
    await tap(page, [3, 5], 200);
    await page.waitForTimeout(700);
    await tap(page, [6], 200);
    await page.waitForTimeout(700);
    await tap(page, [7], 200);
    await page.waitForTimeout(900);
    await shot('checkin-ready');
    await page.getByRole('button', { name: 'Start mission' }).click();
    await expect(page.locator('.sp-st')).toHaveCount(4);
    for (let round = 1; round <= 6; round++) {
      await passAll(page, 4);
      await nextButton(page).click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
    await page.waitForTimeout(4500);
    await page.locator('.sp-fin-summary summary').click();
    await page.waitForTimeout(600);
    await shot('finale-summary');
    await context.close();
  });
}
