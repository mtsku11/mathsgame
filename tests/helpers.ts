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

export interface BoostOptions { autoStart?: boolean; seconds?: number; difficulty?: 'easy' | 'normal' | 'hard'; powers?: number[] }
export interface StartOptions { count?: number; enlarged?: boolean; url?: string; presets?: string[]; pictures?: boolean; autoAdvance?: number; reduced?: boolean; quiet?: boolean; boost?: BoostOptions | false; beforeLaunch?: (page: Page) => Promise<void> }

// The boost settings block of teacher setup. Boost is on by default in the app, so tests that are not about it switch it off.
export async function setBoost(page: Page, boost: BoostOptions | false): Promise<void> {
  const enabled = page.getByLabel('Boost round after every maths round');
  if (boost === false) { await enabled.uncheck(); return; }
  await enabled.check();
  if (boost.autoStart === false) await page.getByLabel('Start each boost round automatically').uncheck();
  if (boost.seconds) await page.getByLabel('Boost length').selectOption(String(boost.seconds));
  if (boost.difficulty) await page.getByLabel('Boost difficulty').selectOption(boost.difficulty);
  for (const [i, power] of (boost.powers ?? []).entries()) await page.getByLabel(`Player ${i + 1} boost power`).selectOption(String(power));
}

// Opens teacher setup, chooses keyboard input and launches the mission on the stage play screen.
export async function startGame(page: Page, { count = 4, enlarged = false, url = './', presets = [], pictures = false, autoAdvance = 0, reduced = false, quiet = false, boost = false, beforeLaunch }: StartOptions = {}): Promise<void> {
  await openSetup(page, url);
  await page.getByLabel('Crew size').selectOption(String(count));
  await setBoost(page, boost);
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

// Runs `body` in the page with the running app's modules (dev server only): events, motion, particles, pixi, arrive.
export interface NC { events: typeof import('../src/app/events'); motion: typeof import('../src/ui/fx/motion'); particles: typeof import('../src/ui/fx/particles'); pixi: typeof import('../src/ui/fx/pixi'); arrive: typeof import('../src/ui/fx/arrive'); boost: import('../src/app/boostRun').BoostRun }
export const nc = <T>(page: Page, body: (modules: NC) => T): Promise<T> => page.evaluate(`(${body.toString()})(window.__nc)`) as Promise<T>;

export const momentEvents = ['answerCorrect', 'answerTry', 'turnHelped', 'turnPassed', 'roundReady', 'roundStart', 'destinationReached', 'missionComplete'] as const;
export const boostEvents = ['boostStart', 'boostGo', 'boostPress', 'boostTier', 'boostFinale', 'boostEnd'] as const;
// Records every moment event the game emits from now on; read them back with `recorded`.
export async function recordEvents(page: Page): Promise<void> {
  await page.evaluate(names => {
    const { events } = (window as unknown as { __nc: { events: { on: (name: string, handler: (payload: unknown) => void) => void } } }).__nc;
    const log: { name: string; payload: unknown }[] = [];
    (window as unknown as { __events: typeof log }).__events = log;
    for (const name of names) events.on(name, payload => { log.push({ name, payload }); });
  }, [...momentEvents]);
}
export const recorded = (page: Page): Promise<{ name: string; payload: unknown }[]> => page.evaluate(() => (window as unknown as { __events: { name: string; payload: unknown }[] }).__events);

// ---- Boost rounds -------------------------------------------------------------------------------------------------------------------------------------------

export interface BoostSnapshotLike { phase: string; energy: number; tier: number; target: number; phaseTime: number; paused: boolean; clock: number; players: number }
// Live view of the running boost state (dev server only).
export const boostState = (page: Page): Promise<BoostSnapshotLike | null> => page.evaluate(() => {
  const state = (window as unknown as { __nc: { boost: { state: BoostSnapshotLike | null } } }).__nc.boost.state;
  return state && { phase: state.phase, energy: state.energy, tier: state.tier, target: state.target, phaseTime: state.phaseTime, paused: state.paused, clock: state.clock, players: state.players };
});
export const boostFlow = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as { __nc: { boost: { flow: string } } }).__nc.boost.flow);
export const boostPhase = async (page: Page): Promise<string | null> => (await boostState(page))?.phase ?? null;

const loggedEvents = [...boostEvents, 'roundReady', 'roundStart', 'destinationReached', 'missionComplete', 'answerCorrect', 'answerTry'];
export interface Logged { name: string; payload: { player?: number; side?: number; tier?: number; round?: number; destination?: number; theme?: string } | undefined; t: number }
// Records every boost, round and answer event from now on, with the page clock; read them with `boostLog`.
export async function recordBoost(page: Page): Promise<void> {
  await page.evaluate(names => {
    const { events } = (window as unknown as { __nc: { events: { on: (name: string, handler: (payload: unknown) => void) => void } } }).__nc;
    const log: { name: string; payload: unknown; t: number }[] = [];
    (window as unknown as { __boostLog: typeof log }).__boostLog = log;
    for (const name of names) events.on(name, payload => { log.push({ name, payload, t: performance.now() }); });
  }, loggedEvents);
}
export const boostLog = (page: Page): Promise<Logged[]> => page.evaluate(() => (window as unknown as { __boostLog: Logged[] }).__boostLog);
export const countOf = async (page: Page, name: string): Promise<number> => (await boostLog(page)).filter(entry => entry.name === name).length;

export const pupilButtons = [[0, 1], [2, 3], [4, 5], [6, 7]] as const;
export interface MashOptions { mode: 'xac' | 'keys'; pupils: number[]; ms?: number; step?: number; untilNotLive?: boolean }
// Presses and releases every switch of the chosen pupils on a steady beat, in the page: down for two steps, up for two, with a pupil's two switches half a cycle apart
// (about 10 presses a second per pupil at the default 50 ms step). With `untilNotLive` it stops as soon as the boost leaves its live phase.
export async function mash(page: Page, { mode, pupils, ms = 4000, step = 50, untilNotLive = false }: MashOptions): Promise<void> {
  await page.evaluate(({ mode, pupils, ms, step, untilNotLive, keys }) => new Promise<void>(resolve => {
    let tick = 0;
    const held = new Set<string>();
    const end = performance.now() + ms;
    // Only the dev server exposes the running modules; production builds can mash for a fixed time.
    const boost = (window as unknown as { __nc?: { boost: { state: { phase: string } | null } } }).__nc?.boost;
    const release = (): void => {
      if (mode === 'xac') window.dispatchEvent(new CustomEvent('mock-buttons', { detail: [] }));
      else held.forEach(code => window.dispatchEvent(new KeyboardEvent('keyup', { code })));
      held.clear();
    };
    const id = setInterval(() => {
      tick++;
      const down: number[] = [];
      for (const pupil of pupils) for (const side of [0, 1]) {
        const on = ((tick + pupil + side * 2) % 4) < 2;
        if (mode === 'xac') { if (on) down.push(pupil * 2 + side); continue; }
        const code = keys[pupil][side];
        if (on && !held.has(code)) { held.add(code); window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase() })); }
        if (!on && held.has(code)) { held.delete(code); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }
      }
      if (mode === 'xac') window.dispatchEvent(new CustomEvent('mock-buttons', { detail: down }));
      if (performance.now() >= end || (untilNotLive && boost?.state?.phase !== 'live')) { clearInterval(id); release(); resolve(); }
    }, step);
  }), { mode, pupils, ms, step, untilNotLive, keys: pupilKeys });
}

// A shared Xbox Adaptive Controller simulated through navigator.getGamepads; `setButtons` presses the listed buttons (two per pupil: 0,1 / 2,3 / 4,5 / 6,7).
// `setConnected(page, false)` unplugs it; plugging it back in reports it in a different slot, as a real one may.
export async function installXac(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let pressed: number[] = [];
    let connected = true;
    let slot = 0;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [connected ? {
      index: slot, id: 'Simulated XAC', connected: true, mapping: 'standard', axes: [0, 1],
      buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
    } : null] });
    window.addEventListener('mock-buttons', event => { pressed = (event as CustomEvent<number[]>).detail; });
    window.addEventListener('mock-connection', event => { connected = (event as CustomEvent<boolean>).detail; if (connected) slot = 2; });
  });
}
export const setButtons = (page: Page, buttons: number[]): Promise<void> => page.evaluate(detail => { window.dispatchEvent(new CustomEvent('mock-buttons', { detail })); }, buttons);
export const setConnected = (page: Page, connected: boolean): Promise<void> => page.evaluate(detail => { window.dispatchEvent(new CustomEvent('mock-connection', { detail })); }, connected);

// On the switch-setup screen: learn every switch, then check each one in practice.
export async function mapAndCheck(page: Page, count: number): Promise<void> {
  const tap = async (buttons: number[]): Promise<void> => { await setButtons(page, buttons); await page.waitForTimeout(150); };
  for (let i = 0; i < count * 2; i++) {
    await page.locator('.map-button').nth(i).click();
    await page.waitForTimeout(150);
    await tap([i]); await tap([]);
    await expect(page.locator('.map-button').nth(i)).toContainText('checked');
  }
  await page.getByRole('button', { name: 'Check switches in practice' }).click();
  await page.waitForTimeout(600);
  await tap(Array.from({ length: count }, (_, i) => i * 2)); await tap([]); await page.waitForTimeout(600);
  await tap(Array.from({ length: count }, (_, i) => i * 2 + 1)); await tap([]);
}

// Setup, learn and check every switch on the simulated XAC, and launch the journey.
export async function startController(page: Page, { count = 4, boost = false }: { count?: number; boost?: BoostOptions | false } = {}): Promise<void> {
  await installXac(page);
  await openSetup(page);
  await page.getByLabel('Crew size').selectOption(String(count));
  await setBoost(page, boost);
  await page.getByRole('button', { name: 'Set up the switches' }).click();
  await mapAndCheck(page, count);
  await page.getByRole('button', { name: 'Launch the journey' }).click();
  await expect(page.locator('.sp-st').first()).toBeVisible();
  await page.waitForTimeout(300);
}

// Passes every pupil (the teacher's control), then starts the boost from the hub button and waits for it to go live.
export async function startBoostRound(page: Page, count: number): Promise<void> {
  await passAll(page, count);
  await page.getByRole('button', { name: 'Boost round!' }).click();
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
}

// Passes every pupil and skips that round's boost from the pause overlay, then moves on: leaves the crew at the start of `round` with its boost still to play.
export async function skipToRound(page: Page, count: number, round: number): Promise<void> {
  for (let current = 1; current < round; current++) {
    await passAll(page, count);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Skip boost round' }).click();
    await nextButton(page).click();
  }
  await passAll(page, count);
  await page.waitForTimeout(400);
}
