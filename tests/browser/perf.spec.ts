import { test, expect } from '@playwright/test';
import { boostFlow, boostLog, boostPhase, correctSide, mash, pupilKeys, recordBoost, skipToRound, startGame, station } from '../helpers';

// Budget from docs/REDESIGN-PLAN.md section 3: at least 45 fps at 1920x1080 under a 4x CPU throttle.
test('four simultaneous correct answers with effects on stay at 45 fps or better at 1920x1080 under 4x CPU throttle', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startGame(page, { count: 4 });
  await expect(page.locator('.fx-canvas')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { ready: boolean } } } }).__nc.particles.particleStats().ready)).toBe(true);
  // The play canvas renders one pixel per screen pixel (1920x1080 here), not the title screen's 2x backing store.
  expect(await page.locator('.fx-canvas').evaluate(canvas => [(canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height])).toEqual([1920, 1080]);
  await page.waitForTimeout(1500);
  const sides = await Promise.all([0, 1, 2, 3].map(index => correctSide(station(page, index))));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const probe = { times: [] as number[], stop: false };
    (window as unknown as { __probe: typeof probe }).__probe = probe;
    const loop = (time: number): void => { probe.times.push(time); if (!probe.stop) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(200);
  await page.evaluate(codes => {
    codes.forEach(code => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase() })));
    setTimeout(() => codes.forEach(code => window.dispatchEvent(new KeyboardEvent('keyup', { code }))), 40);
  }, sides.map((side, index) => pupilKeys[index][side]));
  const sampleStart = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2000);
  const { times, alive, spawned } = await page.evaluate(() => {
    const probe = (window as unknown as { __probe: { times: number[]; stop: boolean } }).__probe;
    probe.stop = true;
    const stats = (window as unknown as { __nc: { particles: { particleStats(): { alive: number; spawned: number } } } }).__nc.particles.particleStats();
    return { times: probe.times, alive: stats.alive, spawned: stats.spawned };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  for (let index = 0; index < 4; index++) await expect(station(page, index).locator('.sp-pill')).toHaveText('Star sent!');
  const window2s = times.filter(time => time >= sampleStart);
  const intervals = window2s.slice(1).map((time, index) => time - window2s[index]);
  const fps = (window2s.length - 1) / ((window2s.at(-1)! - window2s[0]) / 1000);
  const worst = Math.max(...intervals);
  const summary = `${fps.toFixed(1)} fps average over ${((window2s.at(-1)! - window2s[0]) / 1000).toFixed(2)} s (${window2s.length} frames, worst frame ${worst.toFixed(0)} ms, ${spawned} particles spawned, ${alive} alive at end)`;
  console.log(`PERF 1920x1080 4x CPU throttle: ${summary}`);
  test.info().annotations.push({ type: 'fps', description: summary });
  expect(spawned).toBeGreaterThan(80);
  expect(fps).toBeGreaterThanOrEqual(45);
});

// Phases 3a and 3b: a whole boost (live mashing by four pupils, then the MAX finale) with effects on, at the same budget, for each theme.
const boostPerf = [
  { name: 'Warp Drive MAX', round: 2, finaleMs: 4500, tier: 3 },
  { name: 'Firework Frenzy MAX', round: 1, finaleMs: 6000, tier: 3 },
  { name: 'Bubble Blast POP', round: 3, finaleMs: 4000, tier: 3 },
] as const;
for (const { name, round, finaleMs, tier } of boostPerf) {
  test(`${name} with four pupils mashing stays at 45 fps or better at 1920x1080 under 4x CPU throttle`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await startGame(page, { count: 4, boost: { autoStart: false, seconds: 20, difficulty: 'easy' } });
    await expect(page.locator('.fx-canvas')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __nc: { particles: { particleStats(): { ready: boolean } } } }).__nc.particles.particleStats().ready)).toBe(true);
    await skipToRound(page, 4, round);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await recordBoost(page);
    await expect.poll(() => boostPhase(page), { timeout: 15000 }).toBe('live');
    await page.waitForTimeout(600);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const probe = { times: [] as number[], stop: false, alive: 0 };
      (window as unknown as { __probe: typeof probe }).__probe = probe;
      const loop = (time: number): void => {
        probe.times.push(time);
        probe.alive = Math.max(probe.alive, (window as unknown as { __nc: { particles: { particleStats(): { alive: number } } } }).__nc.particles.particleStats().alive);
        if (!probe.stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    // Three seconds of one pupil pressing (bolts or rockets, heat, the others' idle sparkles), then everyone to MAX.
    await mash(page, { mode: 'keys', pupils: [0], ms: 3000 });
    await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 20000, untilNotLive: true });
    await expect.poll(() => boostFlow(page), { timeout: 30000 }).toBe('done');
    const { times, alive } = await page.evaluate(() => { const probe = (window as unknown as { __probe: { times: number[]; stop: boolean; alive: number } }).__probe; probe.stop = true; return { times: probe.times, alive: probe.alive }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const log = await boostLog(page);
    const at = (entry: string): number => log.find(item => item.name === entry)!.t;
    const window_ = (from: number, to: number): { fps: number; worst: number; frames: number } => {
      const inside = times.filter(time => time >= from && time <= to);
      const gaps = inside.slice(1).map((time, index) => time - inside[index]);
      return { fps: (inside.length - 1) / ((inside.at(-1)! - inside[0]) / 1000), worst: Math.max(...gaps), frames: inside.length };
    };
    const live = window_(at('boostGo') + 300, at('boostFinale'));
    const finale = window_(at('boostFinale'), at('boostFinale') + finaleMs);
    const summary = `live mashing ${live.fps.toFixed(1)} fps (${live.frames} frames, worst ${live.worst.toFixed(0)} ms); ${name} finale ${finale.fps.toFixed(1)} fps (${finale.frames} frames, worst ${finale.worst.toFixed(0)} ms); peak ${alive} particles alive`;
    console.log(`PERF 1920x1080 4x CPU throttle, ${name}: ${summary}`);
    test.info().annotations.push({ type: 'fps', description: summary });
    expect(log.some(entry => entry.name === 'boostFinale' && entry.payload?.tier === tier)).toBe(true);
    expect(finale.frames).toBeGreaterThan(60);
    expect(finale.fps).toBeGreaterThanOrEqual(45);
    expect(live.fps).toBeGreaterThanOrEqual(45);
  });
}
