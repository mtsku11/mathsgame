import { test, expect, type Page } from '@playwright/test';
import { answerCorrectly, correctSide, nextButton, passAll, recordEvents, recorded, startGame, station, wrongSide, type NC } from '../helpers';

const nextName = (round: number): string => round === 6 ? 'Finish journey' : 'Next round';
const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};
const inPage = <T, K extends keyof NC>(page: Page, key: K, body: (module: NC[K]) => T): Promise<T> => page.evaluate(`(${body.toString()})(window.__nc.${key})`) as Promise<T>;
const motion = <T>(page: Page, body: (motion: NC['motion']) => T): Promise<T> => inPage(page, 'motion', body);
const particles = <T>(page: Page, body: (fx: NC['particles']) => T): Promise<T> => inPage(page, 'particles', body);
// Adds every .sp-fly element the page creates to window.__flights with its lifetime in ms.
const watchFlights = (page: Page): Promise<void> => page.evaluate(() => {
  const flights: { born: number; died: number | null; el: Element }[] = [];
  (window as unknown as { __flights: typeof flights }).__flights = flights;
  new MutationObserver(records => records.forEach(record => {
    record.addedNodes.forEach(node => { if (node instanceof Element && node.classList.contains('sp-fly')) flights.push({ born: performance.now(), died: null, el: node }); });
    record.removedNodes.forEach(node => { const flight = flights.find(item => item.el === node); if (flight) flight.died = performance.now(); });
  })).observe(document.querySelector('.stage')!, { childList: true, subtree: true });
});
const flights = (page: Page): Promise<{ born: number; died: number | null }[]> => page.evaluate(() => (window as unknown as { __flights: { born: number; died: number | null }[] }).__flights.map(({ born, died }) => ({ born, died })));

test('each moment event fires exactly once, in order, with the right payload', async ({ page }) => {
  const errors = errorsOf(page);
  await startGame(page, { count: 2, url: './?instant', beforeLaunch: recordEvents });
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await wrongSide(first)).click();
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await page.waitForTimeout(650);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await expect(first.locator('.sp-pill')).toHaveText('Star sent!');
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await expect(nextButton(page)).toBeVisible();
  await page.waitForTimeout(300);
  const round1 = (await recorded(page)).map(({ name, payload }) => name === 'roundStart' || name === 'roundReady' ? `${name} ${(payload as { round: number }).round}` : name);
  expect(round1).toEqual(['roundStart 1', 'answerTry', 'turnHelped', 'answerCorrect', 'turnPassed', 'roundReady 1']);
  const detail = (await recorded(page)).filter(({ name }) => name === 'answerTry' || name === 'answerCorrect' || name === 'turnHelped' || name === 'turnPassed');
  expect(detail.map(item => (item.payload as { player: number }).player)).toEqual([0, 0, 0, 1]);
  expect((detail[0].payload as { side: number }).side).toBe(await wrongSide(first));
  expect((detail[2].payload as { side: number }).side).toBe(await correctSide(first));

  await nextButton(page).click();
  for (let round = 2; round <= 6; round++) { await passAll(page, 2); await page.getByRole('button', { name: nextName(round) }).click(); }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  const names = (await recorded(page)).slice(6).map(({ name, payload }) => {
    const value = payload as { round?: number; destination?: number; stars?: number } | undefined;
    return value?.round ? `${name} ${value.round}` : value?.destination !== undefined ? `${name} ${value.destination}` : value?.stars !== undefined ? `${name} ${value.stars}` : name;
  });
  const expected = ['roundStart 2'];
  for (let round = 2; round <= 6; round++) {
    expected.push('turnPassed', 'turnPassed', `roundReady ${round}`);
    if (round < 6) expected.push(`roundStart ${round + 1}`);
    if (round === 2) expected.push('destinationReached 1');
    if (round === 4) expected.push('destinationReached 2');
  }
  expected.push('missionComplete 1');
  expect(names).toEqual(expected);
  expect(errors).toEqual([]);
});

test('full motion: a star flies from the pressed button to the core in 1.2 s or less and the total ticks up on arrival', async ({ page }) => {
  const errors = errorsOf(page);
  await startGame(page, { count: 2 });
  await watchFlights(page);
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await expect(page.locator('.sp-fly')).toHaveCount(1);
  await expect(page.locator('.sp-core-num')).toHaveText('0');
  await expect(page.getByRole('img', { name: 'Crew stars: 0' })).toBeVisible();
  await expect(page.locator('.sp-core-num')).toHaveText('1');
  await expect(page.locator('.sp-fly')).toHaveCount(0);
  await expect(first.locator('.sp-pill')).toHaveText('Star sent!');
  const [flight] = await flights(page);
  expect(flight.died! - flight.born).toBeGreaterThan(600);
  expect(flight.died! - flight.born).toBeLessThanOrEqual(1200);
  expect(await flights(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a flying star that is interrupted by the next round still lets the total settle', async ({ page }) => {
  await startGame(page, { count: 1 });
  const only = station(page, 0);
  await only.locator('.sp-btn').nth(await correctSide(only)).click();
  await expect(page.locator('.sp-fly')).toHaveCount(1);
  await nextButton(page).click();
  await expect(page.locator('.sp-fly')).toHaveCount(0);
  await expect(page.locator('.sp-core-num')).toHaveText('1');
});

test('reduced motion: the star lands in the core at once with no flying element and no motion timelines', async ({ page }) => {
  const errors = errorsOf(page);
  await startGame(page, { count: 2, reduced: true });
  await watchFlights(page);
  const before = await particles(page, fx => fx.particleStats().spawned);
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await expect(page.locator('.sp-core-num')).toHaveText('1', { timeout: 250 });
  await expect(first.locator('.sp-btn.is-right')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await expect(page.locator('.sp-banner-card')).toBeVisible();
  await expect(page.locator('.sp-banner-card')).toHaveText('Round complete!');
  expect(await page.locator('.sp-banner-card').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  expect(await flights(page)).toEqual([]);
  await expect(page.locator('.sp-fly')).toHaveCount(0);
  expect(await particles(page, fx => fx.particleStats())).toMatchObject({ enabled: false, spawned: before });
  await expect(page.locator('.sp-pip.is-earned')).toHaveCount(1);
  await nextButton(page).click();
  await expect(page.locator('.sp-pip.is-done')).toHaveCount(1);
  await expect(page.locator('.sp-pip.is-earned')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('low stimulation: static equivalents, but the gold burst still runs at a quarter of the particles', async ({ page }) => {
  await startGame(page, { count: 2 });
  await motion(page, m => m.setLowStim(true));
  await watchFlights(page);
  const before = await particles(page, fx => fx.particleStats().spawned);
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await expect(page.locator('.sp-core-num')).toHaveText('1', { timeout: 250 });
  expect(await flights(page)).toEqual([]);
  const stats = await particles(page, fx => fx.particleStats());
  expect(stats.spawned - before).toBe(7);
  expect(stats.cap).toBe(625);
  const wrong = station(page, 1);
  await page.waitForTimeout(100);
  await wrong.locator('.sp-btn').nth(await wrongSide(wrong)).click();
  await expect(wrong.locator('.sp-btn.is-pulse')).toHaveCount(1);
});

test('particle counts and caps follow quality, low stimulation, reduced motion and instant mode', async ({ page }) => {
  await startGame(page, { count: 1 });
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await expect.poll(() => particles(page, fx => fx.particleStats().ready)).toBe(true);
  const spawned = () => particles(page, fx => fx.particleStats().spawned);
  const start = await spawned();
  await particles(page, fx => fx.burst(640, 360, { count: 40 }));
  expect(await spawned() - start).toBe(40);
  await particles(page, fx => fx.burst(640, 360, { count: 6000, life: [5, 6] }));
  const stats = await particles(page, fx => fx.particleStats());
  expect(stats.cap).toBe(2500);
  await expect.poll(() => particles(page, fx => fx.particleStats().alive)).toBeLessThanOrEqual(2500);
  await particles(page, fx => fx.clearParticles());
  expect(await particles(page, fx => fx.particleStats().alive)).toBe(0);
  const qualities = await inPage(page, 'pixi', pixi => ({ high: pixi.particleBudget('high'), medium: pixi.particleBudget('medium'), low: pixi.particleBudget('low') }));
  expect(qualities).toEqual({ high: 2500, medium: 1200, low: 600 });
  await motion(page, m => m.setLowStim(true));
  const lowStart = await spawned();
  await particles(page, fx => fx.burst(640, 360, { count: 40 }));
  expect(await spawned() - lowStart).toBe(10);
  expect(await inPage(page, 'pixi', pixi => pixi.particleBudget('low'))).toBe(150);
  await motion(page, m => { m.setLowStim(false); m.setReducedMotion(true); });
  const reducedStart = await spawned();
  await particles(page, fx => { fx.burst(640, 360, { count: 40 }); fx.confetti(); fx.rain(); });
  expect(await spawned()).toBe(reducedStart);
  expect(await particles(page, fx => fx.particleStats().enabled)).toBe(false);
});

test('instant mode with the effects layer on still emits no particles and leaves no running motion', async ({ page }) => {
  await startGame(page, { count: 2, url: './?instant&fx' });
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await expect.poll(() => particles(page, fx => fx.particleStats().ready)).toBe(true);
  await particles(page, fx => fx.burst(640, 360, { count: 40 }));
  expect(await particles(page, fx => fx.particleStats())).toMatchObject({ enabled: false, spawned: 0, alive: 0 });
});

test('instant mode: every moment completes at once and leaves no running timelines or flying stars', async ({ page }) => {
  const errors = errorsOf(page);
  await startGame(page, { count: 2, url: './?instant' });
  const first = station(page, 0);
  await first.locator('.sp-btn').nth(await wrongSide(first)).click();
  await page.getByRole('button', { name: 'Help player 1', exact: true }).click();
  await page.waitForTimeout(650);
  await first.locator('.sp-btn').nth(await correctSide(first)).click();
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await expect(nextButton(page)).toBeVisible();
  await expect(page.locator('.sp-core-num')).toHaveText('1');
  await nextButton(page).click();
  await passAll(page, 2);
  await nextButton(page).click();
  await expect(page.locator('.sp-dest-name')).toHaveText('Candy Planet');
  await page.waitForTimeout(400);
  expect(await motion(page, m => m.runningMotion())).toBe(0);
  await expect(page.locator('.sp-fly')).toHaveCount(0);
  await expect(page.locator('.sp-banner')).toBeHidden();
  await expect(page.locator('.sp-card')).toBeHidden();
  expect(await page.locator('.sp-st').evaluateAll(cards => cards.every(card => (card as HTMLElement).style.transform === '' && (card as HTMLElement).style.opacity === ''))).toBe(true);
  expect(errors).toEqual([]);
});

test('round start deals the questions in within 600 ms and never delays the switches', async ({ page }) => {
  await startGame(page, { count: 4 });
  await page.waitForTimeout(900);
  await passAll(page, 4);
  const result = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll<HTMLElement>('.sp-st')];
    const next = document.querySelector<HTMLElement>('.sp-next')!;
    const start = performance.now();
    next.click();
    const opacities = () => cards.map(card => Number(getComputedStyle(card).opacity));
    const first = opacities();
    // Arming needs 100 ms of release after the round change; the deal-in is still running when the first switch lands.
    let stillDealing = false;
    setTimeout(() => { stillDealing = cards.some(card => card.style.transform !== ''); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' })), 40); }, 250);
    let midOpacity = 1;
    const done = await new Promise<number>(resolve => {
      const tick = () => {
        const values = opacities();
        if (performance.now() - start > 100 && performance.now() - start < 130) midOpacity = Math.min(...values);
        if (cards.every(card => card.style.transform === '' && card.style.opacity === '') && performance.now() - start > 50) resolve(performance.now() - start);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { first, done, midOpacity, stillDealing };
  });
  expect(result.first.every(value => value === 0)).toBe(true);
  expect(result.done).toBeLessThanOrEqual(700);
  expect(result.done).toBeGreaterThan(450);
  expect(result.midOpacity).toBeLessThan(1);
  expect(result.stillDealing).toBe(true);
  const answered = await page.locator('.sp-st').first().locator('.sp-pill').textContent();
  expect(['Star sent!', 'Try again']).toContain(answered);
});

for (const count of [2, 3]) {
  test(`destination arrival with ${count} pupils: the new planet swells in, a Welcome card shows, then it settles`, async ({ page }) => {
    const errors = errorsOf(page);
    await startGame(page, { count });
    await page.waitForTimeout(700);
    await passAll(page, count);
    await nextButton(page).click();
    await page.waitForTimeout(650);
    await passAll(page, count);
    const heroSelector = count === 3 ? '.sp-big-planet' : '.sp-dest-planet';
    await page.evaluate(selector => {
      const samples: number[] = [];
      (window as unknown as { __scales: number[] }).__scales = samples;
      const hero = document.querySelector(selector)!;
      const loop = () => { const m = getComputedStyle(hero).transform; samples.push(m === 'none' ? 1 : Number(m.slice(7).split(',')[0])); if (samples.length < 400) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }, heroSelector);
    await nextButton(page).click();
    const hero = page.locator(heroSelector);
    const card = page.locator('.sp-card');
    await expect(page.locator('.sp-stop.is-current .sr-only')).toHaveText('Candy Planet, current destination');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Welcome to');
    await expect(card).toContainText('Candy Planet');
    const scale = () => hero.evaluate(element => { const m = getComputedStyle(element).transform; return m === 'none' ? 1 : Number(m.slice(7).split(',')[0]); });
    expect(await scale()).toBeLessThan(1);
    await expect.poll(scale, { timeout: 3000 }).toBe(1);
    const samples = await page.evaluate(() => (window as unknown as { __scales: number[] }).__scales);
    expect(Math.min(...samples)).toBeLessThan(0.3);
    expect(Math.max(...samples)).toBeGreaterThan(1.1);
    await expect(card).toBeHidden({ timeout: 4500 });
    await expect(hero).toHaveCSS('transform', 'none');
    await expect(page.locator(count === 3 ? '.sp-big-name' : '.sp-dest-name')).toHaveText('Candy Planet');
    expect(errors).toEqual([]);
  });
}

test('reduced motion destination arrival is a static card with no swelling', async ({ page }) => {
  await startGame(page, { count: 2, reduced: true });
  await passAll(page, 2);
  await nextButton(page).click();
  await passAll(page, 2);
  await nextButton(page).click();
  await expect(page.locator('.sp-card')).toBeVisible();
  await expect(page.locator('.sp-card')).toContainText('Candy Planet');
  await expect(page.locator('.sp-dest-planet')).toHaveCSS('transform', 'none');
  await expect(page.locator('.sp-card')).toBeHidden({ timeout: 4000 });
});

test('arriveAt can be called on its own and does nothing once the play screen is gone', async ({ page }) => {
  await startGame(page, { count: 2 });
  const result = await inPage(page, 'arrive', async arrive => {
    arrive.arriveAt(2);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { name: document.querySelector('.sp-dest-name')!.textContent, card: !document.querySelector<HTMLElement>('.sp-card')!.hidden };
  });
  expect(result).toEqual({ name: 'Frosty Moon', card: true });
});

test('round ready shows the Round complete banner for about 2.5 s when a turn was passed, and the round pip fills', async ({ page }) => {
  await startGame(page, { count: 2 });
  await answerCorrectly(page, 0);
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  const started = Date.now();
  await expect(page.locator('.sp-banner-card')).toBeVisible();
  await expect(page.locator('.sp-banner-card')).toHaveText('Round complete!');
  await expect(page.locator('.sp-pip.is-earned')).toHaveCount(1);
  await expect(page.locator('.sp-pip.is-done')).toHaveCount(0);
  await expect(page.locator('.sp-banner')).toBeHidden({ timeout: 4000 });
  expect(Date.now() - started).toBeGreaterThan(1800);
  await expect(nextButton(page)).toBeVisible();
});

test('finale: teacher observation is collapsed by default, buttons replay and return to setup', async ({ page }) => {
  const errors = errorsOf(page);
  await startGame(page, { count: 2, url: './?instant' });
  await answerCorrectly(page, 0);
  await page.getByRole('button', { name: 'Pass player 2', exact: true }).click();
  await nextButton(page).click();
  for (let round = 2; round <= 6; round++) { await passAll(page, 2); await page.getByRole('button', { name: nextName(round) }).click(); }
  await expect(page.getByRole('heading', { name: 'Mission complete!', level: 1 })).toBeVisible();
  await expect(page.locator('.sp-fin-stars')).toContainText('1 crew stars collected');
  await expect(page.getByRole('img', { name: 'Crew stars: 1' })).toBeVisible();
  await expect(page.locator('.sp-core-num')).toHaveText('1');
  await expect(page.locator('#game-status')).toHaveText('Mission complete. 1 crew stars collected.');
  const details = page.locator('.sp-fin-summary');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(details.locator('table')).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('table')).toBeVisible();
  expect(await details.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.children].map(cell => cell.textContent)))).toEqual([
    ['Player 1 · Pink pilot', '1', '0', '0', '5'], ['Player 2 · Blue pilot', '0', '0', '0', '6']]);
  await expect(details).toContainText('This is observation, not an attainment score.');
  await expect(details).toContainText('No pupil data is saved.');
  expect(await page.getByText(/rank|winner|best|fastest/i).count()).toBe(0);
  const box = await page.locator('.sp-fin-actions').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1280);

  await page.getByRole('button', { name: 'Another adventure' }).click();
  await expect(page.getByRole('button', { name: 'Start anyway' })).toBeVisible();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await expect(page.locator('.sp-core-num')).toHaveText('0');
  await expect(page.locator('.sp-round')).toHaveText('Round 1 of 6');
  for (let round = 1; round <= 6; round++) { await passAll(page, 2); await page.getByRole('button', { name: nextName(round) }).click(); }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await expect(page.getByLabel('Crew size')).toBeVisible();
  expect(errors).toEqual([]);
});

test('full-motion mission with the effects layer: finale confetti stops within four seconds, no console errors', async ({ page }) => {
  test.setTimeout(90000);
  const errors = errorsOf(page);
  await startGame(page, { count: 2 });
  await page.waitForTimeout(700);
  for (let round = 1; round <= 6; round++) {
    await passAll(page, 2);
    await page.getByRole('button', { name: nextName(round) }).click();
    await page.waitForTimeout(round === 2 || round === 4 ? 400 : 200);
  }
  await expect(page.getByRole('heading', { name: 'Mission complete!' })).toBeVisible();
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await expect.poll(() => particles(page, fx => fx.particleStats().spawned), { timeout: 3000 }).toBeGreaterThan(100);
  await expect(page.locator('.sp-core-num')).toHaveText('0', { timeout: 100 });
  await page.waitForTimeout(4400);
  expect(await particles(page, fx => fx.particleStats().alive)).toBe(0);
  expect(await page.locator('.sp-fin-bob').first().evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
  expect(errors).toEqual([]);
});

test('finale reduced motion: static final scene, no confetti, total shown at once', async ({ page }) => {
  await startGame(page, { count: 2, reduced: true });
  await answerCorrectly(page, 0);
  await answerCorrectly(page, 1);
  await nextButton(page).click();
  for (let round = 2; round <= 6; round++) { await passAll(page, 2); await page.getByRole('button', { name: nextName(round) }).click(); }
  await expect(page.locator('.sp-core-num')).toHaveText('2', { timeout: 200 });
  expect(await particles(page, fx => fx.particleStats().spawned)).toBe(0);
  expect(await page.locator('.sp-fin-bob').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === 'none'))).toBe(true);
  await expect(page.locator('.sp-fin-title')).toHaveCSS('opacity', '1');
});

test('the banner says All stars collected! only when every turn was correct, and sits above the stations', async ({ page }) => {
  await startGame(page, { count: 4 });
  for (let index = 0; index < 4; index++) await answerCorrectly(page, index);
  const card = page.locator('.sp-banner-card');
  await expect(card).toHaveText('All stars collected!');
  await expect(card).toBeVisible();
  // Layout position, not the animated box: the card sits in the band above the first station.
  const layout = await page.evaluate(() => { const banner = document.querySelector<HTMLElement>('.sp-banner')!, first = document.querySelector<HTMLElement>('.sp-st')!; return { bottom: banner.offsetTop + banner.offsetHeight, top: banner.offsetTop, stationTop: first.offsetTop }; });
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.bottom).toBeLessThanOrEqual(layout.stationTop);
  await expect(page.locator('.sp-banner')).toBeHidden({ timeout: 4000 });
});

// Phase 2 follow-up: the star's path was tuned for four players. In every layout it must leave the pressed answer button and land in the mothership core, inside the stage all the way.
test('the flying star starts at the pressed button and ends at the mothership core in the 1, 2, 3 and 4 player layouts', async ({ page }) => {
  test.setTimeout(120000);
  const errors = errorsOf(page);
  for (const count of [1, 2, 3, 4]) {
    await startGame(page, { count });
    await page.evaluate(() => {
      const stage = document.querySelector('.stage')!, holder = window as unknown as { __path: { x: number; y: number }[] };
      holder.__path = [];
      const loop = (): void => {
        const fly = document.querySelector('.sp-fly');
        if (fly) { const box = fly.getBoundingClientRect(), frame = stage.getBoundingClientRect(), k = 1280 / frame.width; holder.__path.push({ x: (box.left + box.width / 2 - frame.left) * k, y: (box.top + box.height / 2 - frame.top) * k }); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    for (let pupil = 0; pupil < count; pupil++) {
      const target = station(page, pupil);
      const button = target.locator('.sp-btn').nth(await correctSide(target));
      await page.evaluate(() => { (window as unknown as { __path: unknown[] }).__path = []; });
      const from = await button.evaluate(element => { const box = element.getBoundingClientRect(), frame = document.querySelector('.stage')!.getBoundingClientRect(), k = 1280 / frame.width; return { x: (box.left + box.width / 2 - frame.left) * k, y: (box.top + box.height / 2 - frame.top) * k }; });
      await button.click();
      await expect(page.locator('.sp-fly')).toHaveCount(1);
      await expect(page.locator('.sp-fly')).toHaveCount(0, { timeout: 3000 });
      const path = await page.evaluate(() => (window as unknown as { __path: { x: number; y: number }[] }).__path);
      const core = await page.locator('.sp-hub .sp-ship').evaluate(element => { const box = element.getBoundingClientRect(), frame = document.querySelector('.stage')!.getBoundingClientRect(), k = 1280 / frame.width; return { x: (box.left + box.width / 2 - frame.left) * k, y: (box.top + box.height / 2 - frame.top) * k }; });
      const gap = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
      expect(path.length, `${count} players, pupil ${pupil + 1}: frames sampled`).toBeGreaterThan(20);
      expect(gap(path[0], from), `${count} players, pupil ${pupil + 1}: start to the pressed button`).toBeLessThan(30);
      expect(gap(path.at(-1)!, core), `${count} players, pupil ${pupil + 1}: end to the core`).toBeLessThan(30);
      expect(path.every(point => point.x > 0 && point.x < 1280 && point.y > 0 && point.y < 720), `${count} players, pupil ${pupil + 1}: stays on the stage`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
