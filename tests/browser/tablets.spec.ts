import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { correctSide, openSetup, setBoost, station } from '../helpers';

// Real tablet pages talk to the game through the relay: locally the workerd relay that playwright.config.ts starts, on the hosted site the published one.
const query = process.env.PLAYWRIGHT_BASE_URL ? '' : '?relay=ws://127.0.0.1:8791';
const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};

async function tabletSetup(page: Page, count: number): Promise<void> {
  await openSetup(page, `./${query}`);
  await page.getByLabel('Crew size').selectOption(String(count));
  await setBoost(page, false);
  await page.getByLabel('Tablets').check();
  await page.getByRole('button', { name: 'Connect the tablets' }).click();
  await expect(page.getByRole('heading', { name: 'Connect a tablet for each pilot' })).toBeVisible();
  await expect(page.locator('#tablet-status')).toHaveText(`0 of ${count} tablets connected.`);
}
const link = (page: Page, player: number): Promise<string> => page.locator('.tb-qr').nth(player).getAttribute('data-link') as Promise<string>;
async function openTablet(context: BrowserContext, page: Page, player: number | string): Promise<Page> {
  const pad = await context.newPage();
  await pad.goto(typeof player === 'string' ? player : await link(page, player));
  await expect(pad.locator('.pad-status')).toHaveText('Connected to the game');
  return pad;
}
// A tap as a finger makes it, through pointer events on the tablet's button.
async function tap(pad: Page, side: number): Promise<void> {
  const box = (await pad.locator('.pad-btn').nth(side).boundingBox())!;
  await pad.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pad.mouse.down(); await pad.waitForTimeout(80); await pad.mouse.up();
}
async function checkIn(page: Page, pads: Page[]): Promise<void> {
  await page.getByRole('button', { name: 'Start crew check-in' }).click();
  await page.waitForTimeout(600);
  for (const side of [0, 1]) {
    for (const pad of pads) await tap(pad, side);
    await page.waitForTimeout(700);
  }
  await expect(page.locator('#ck-count')).toHaveText(`${pads.length} of ${pads.length} pilots ready`);
  await page.getByRole('button', { name: 'Start mission' }).click();
  await expect(station(page, 0)).toBeVisible();
  await page.waitForTimeout(300);
}

test('four tablets: each joins by its link, lights its buttons on the setup screen, checks in, and answers its own question', async ({ page, context }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await tabletSetup(page, 4);
  expect(await link(page, 2)).toMatch(/\/pad\.html(\?relay=[^#]+)?#[A-HJKMNP-Z2-9]{8}-3$/);
  const pads: Page[] = [];
  for (let player = 0; player < 4; player++) {
    pads.push(await openTablet(context, page, player));
    await expect(page.locator('.tb-state').nth(player)).toHaveText('Tablet connected');
  }
  await expect(page.locator('#tablet-status')).toHaveText('All 4 tablets are connected. Next, the crew checks them together.');
  await expect(pads[1].locator('.pad-who')).toContainText('Player 2');
  // Holding a tablet button lights that player's button here, and nobody else's.
  const box = (await pads[2].locator('.pad-btn').nth(1).boundingBox())!;
  await pads[2].mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pads[2].mouse.down();
  await expect(page.locator('.tb-slot.is-on')).toHaveCount(1);
  await expect(page.locator('.tb-slot[data-tablet-player="2"][data-tablet-side="1"]')).toHaveClass(/is-on/);
  await pads[2].mouse.up();
  await expect(page.locator('.tb-slot.is-on')).toHaveCount(0);
  await checkIn(page, pads);
  for (let player = 0; player < 4; player++) {
    await tap(pads[player], await correctSide(station(page, player)));
    await expect(station(page, player).locator('.sp-pill')).toHaveText('Star sent!');
  }
  expect(errors).toEqual([]);
});

test('a tablet that drops out pauses the game; reopened, it reconnects and the crew carries on', async ({ page, context }) => {
  test.setTimeout(90000);
  await tabletSetup(page, 2);
  const links = [await link(page, 0), await link(page, 1)];
  const pads = [await openTablet(context, page, links[0]), await openTablet(context, page, links[1])];
  await checkIn(page, pads);
  const before = await page.locator('.sp-st').allTextContents();
  await pads[1].close();
  await expect(page.getByRole('dialog')).toContainText('Player 2’s tablet lost the connection');
  pads[1] = await openTablet(context, page, links[1]);
  await page.getByRole('button', { name: 'Resume journey' }).click();
  expect(await page.locator('.sp-st').allTextContents()).toEqual(before);
  await page.waitForTimeout(200);
  await tap(pads[1], await correctSide(station(page, 1)));
  await expect(station(page, 1).locator('.sp-pill')).toHaveText('Star sent!');
});

test('a tablet can join by typing the room code, and a second tablet for the same player takes over', async ({ page, context }) => {
  test.setTimeout(60000);
  await tabletSetup(page, 2);
  const room = (await page.locator('.tb-room').first().textContent())!;
  const typed = await context.newPage();
  await typed.goto(`./pad.html${query}`);
  await typed.getByLabel('Room code').fill(room.toLowerCase());
  await typed.getByText('2', { exact: true }).click();
  await typed.getByRole('button', { name: 'Join' }).click();
  await expect(typed.locator('.pad-status')).toHaveText('Connected to the game');
  await expect(page.locator('.tb-state').nth(1)).toHaveText('Tablet connected');
  await expect(page.locator('.tb-state').nth(0)).toHaveText('Waiting for tablet');
  const second = await openTablet(context, page, 1);
  await expect(typed.locator('.pad-status')).toHaveText('Another tablet is now Player 2');
  await expect(page.locator('.tb-state').nth(1)).toHaveText('Tablet connected');
  await typed.getByRole('button', { name: 'Use this tablet for Player 2' }).click();
  await expect(typed.locator('.pad-status')).toHaveText('Connected to the game');
  await expect(second.locator('.pad-status')).toHaveText('Another tablet is now Player 2');
});

test('a wrong room code is refused on the tablet', async ({ page }) => {
  await page.goto(`./pad.html${query}`);
  await page.getByLabel('Room code').fill('OOOO1111');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('alert')).toContainText('That code is not right');
});

test('the tablet setup screen says when the relay cannot be reached', async ({ page }) => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'the hosted site always uses the published relay');
  await openSetup(page, './?relay=ws://127.0.0.1:9');
  await page.getByLabel('Tablets').check();
  await page.getByRole('button', { name: 'Connect the tablets' }).click();
  await expect(page.locator('#tablet-status')).toContainText('Cannot reach the tablet relay yet');
});
