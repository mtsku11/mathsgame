import { expect, type Locator, type Page } from '@playwright/test';

export async function enterSetup(page: Page): Promise<void> {
  const teacher = page.getByRole('button', { name: 'Teacher setup', exact: true });
  const setup = page.getByLabel('Crew size');
  await expect(teacher.or(setup)).toBeVisible();
  if (await teacher.isVisible()) await teacher.click();
  await expect(setup).toBeVisible();
}

export async function openSetup(page: Page, url = './'): Promise<void> {
  await page.goto(url);
  await enterSetup(page);
}

export interface StartOptions { count?: number; enlarged?: boolean; url?: string; presets?: string[]; pictures?: boolean; autoAdvance?: number; reduced?: boolean; quiet?: boolean; beforeLaunch?: (page: Page) => Promise<void> }

// Opens teacher setup, chooses keyboard input and launches the mission on the stage play screen.
export async function startGame(page: Page, { count = 4, enlarged = false, url = './', presets = [], pictures = false, autoAdvance = 0, reduced = false, quiet = false, beforeLaunch }: StartOptions = {}): Promise<void> {
  await openSetup(page, url);
  await page.getByLabel('Crew size').selectOption(String(count));
  if (enlarged) await page.getByLabel('Screen layout').selectOption('enlarged');
  for (const [i, preset] of presets.entries()) await page.getByLabel(`Player ${i + 1} maths`).selectOption(preset);
  if (pictures || reduced || quiet) await page.getByText('Comfort & access settings', { exact: true }).click();
  if (reduced) await page.getByLabel('Reduce motion').check();
  if (quiet) await page.getByLabel('Quiet mode').check();
  if (pictures) for (const checkbox of await page.getByLabel('Picture answers for addition').all()) await checkbox.check();
  if (autoAdvance) {
    await page.getByLabel('Advance completed rounds automatically').check();
    await page.getByLabel('Celebration delay').selectOption(String(autoAdvance));
  }
  await page.getByLabel('Keyboard & on-screen buttons').check();
  await page.getByRole('button', { name: 'Enter practice' }).click();
  await beforeLaunch?.(page);
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await expect(page.locator('.sp-st').first()).toBeVisible();
  await page.waitForTimeout(150);
}

export const station = (page: Page, index: number): Locator => page.locator('.sp-st').nth(index);

// Answer buttons are named "Player N, left answer, X"; the star objects give the true total.
export async function choices(target: Locator): Promise<number[]> {
  return (await target.locator('.sp-btn').evaluateAll(buttons => buttons.map(button => Number(button.getAttribute('aria-label')!.split(', ').pop())))) as number[];
}
export async function correctSide(target: Locator): Promise<number> {
  const total = await target.locator('.sp-obj').count();
  const side = (await choices(target)).findIndex(value => value === total);
  expect(side).toBeGreaterThanOrEqual(0);
  return side;
}
export async function answerCorrectly(page: Page, index: number): Promise<void> {
  const target = station(page, index);
  await target.locator('.sp-btn').nth(await correctSide(target)).click();
  await expect(target.locator('.sp-pill')).toHaveText('Star sent!');
}
export async function wrongSide(target: Locator): Promise<number> { return 1 - await correctSide(target); }
export const passAll = async (page: Page, count: number): Promise<void> => {
  for (let pupil = 1; pupil <= count; pupil++) await page.getByRole('button', { name: `Pass player ${pupil}`, exact: true }).click();
};
export const nextButton = (page: Page, name = /^(Next round|Finish journey|Next player)$/): Locator => page.getByRole('button', { name });

// Default keyboard bindings: left/right keys per pupil, as configured in settings.
export const pupilKeys = [['KeyF', 'KeyJ'], ['KeyA', 'KeyL'], ['KeyC', 'KeyM'], ['KeyQ', 'KeyP']] as const;
export async function tapKey(page: Page, player: number, side: number, holdMs = 40): Promise<void> {
  const code = pupilKeys[player][side];
  await page.evaluate(([value]) => { window.dispatchEvent(new KeyboardEvent('keydown', { code: value, key: value.slice(3).toLowerCase() })); }, [code]);
  await page.waitForTimeout(holdMs);
  await page.evaluate(([value]) => { window.dispatchEvent(new KeyboardEvent('keyup', { code: value })); }, [code]);
}

export const momentEvents = ['answerCorrect', 'answerTry', 'turnHelped', 'turnPassed', 'roundReady', 'roundStart', 'destinationReached', 'missionComplete'] as const;
// Records every moment event the game emits from now on; read them back with `recorded`.
export async function recordEvents(page: Page): Promise<void> {
  await page.evaluate(async names => {
    const { events } = await import('/src/app/events.ts');
    const log: { name: string; payload: unknown }[] = [];
    (window as unknown as { __events: typeof log }).__events = log;
    for (const name of names) events.on(name as never, ((payload: unknown) => { log.push({ name, payload }); }) as never);
  }, [...momentEvents]);
}
export const recorded = (page: Page): Promise<{ name: string; payload: unknown }[]> => page.evaluate(() => (window as unknown as { __events: { name: string; payload: unknown }[] }).__events);
