import { test, expect, type Page } from '@playwright/test';
import { boostFlow, boostPhase, mash, nextButton, passAll, startGame } from '../helpers';

// WCAG 2.3.1 flash safety for the boost finales, measured from captured frames rather than from the code: at most one large flash in any second.
// The page is screencast at about 50 frames a second at 320x180; each frame's mean luminance is computed and a "large flash" is a frame-to-frame jump of more than 0.1 of full scale.
// Two scales are checked: relative luminance (linear, as WCAG defines it) and gamma-encoded luma (what the eye's response roughly follows, and the stricter of the two here).
const THRESHOLD = 0.1;
interface Flash { frames: number; seconds: number; fps: number; linear: Scale; gamma: Scale }
interface Scale { maxJump: number; largeJumps: number; worstPerSecond: number; min: number; max: number }

async function measure(page: Page, run: () => Promise<void>): Promise<Flash> {
  const context = page.context();
  const cdp = await context.newCDPSession(page);
  const frames: { data: string; t: number }[] = [];
  cdp.on('Page.screencastFrame', event => {
    frames.push({ data: event.data, t: event.metadata.timestamp! });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 320, maxHeight: 180, everyNthFrame: 1 });
  await run();
  await cdp.send('Page.stopScreencast');
  const decoder = await context.newPage();
  const samples = await decoder.evaluate(async list => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    const lin = (c: number): number => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const out: { t: number; linear: number; gamma: number }[] = [];
    for (const frame of list) {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${frame.data}`;
      await image.decode();
      g.drawImage(image, 0, 0, 320, 180);
      const d = g.getImageData(0, 0, 320, 180).data;
      let a = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { a += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); b += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; }
      out.push({ t: frame.t, linear: a / (d.length / 4), gamma: b / (d.length / 4) });
    }
    return out;
  }, frames);
  await decoder.close();
  const scale = (key: 'linear' | 'gamma'): Scale => {
    const jumps: number[] = [];
    let maxJump = 0;
    for (let i = 1; i < samples.length; i++) {
      const delta = Math.abs(samples[i][key] - samples[i - 1][key]);
      maxJump = Math.max(maxJump, delta);
      if (delta > THRESHOLD) jumps.push(samples[i].t);
    }
    const worstPerSecond = Math.max(0, ...jumps.map(start => jumps.filter(t => t >= start && t < start + 1).length));
    const values = samples.map(sample => sample[key]);
    return { maxJump: +maxJump.toFixed(3), largeJumps: jumps.length, worstPerSecond, min: +Math.min(...values).toFixed(3), max: +Math.max(...values).toFixed(3) };
  };
  const seconds = samples.at(-1)!.t - samples[0].t;
  return { frames: samples.length, seconds: +seconds.toFixed(2), fps: +(samples.length / seconds).toFixed(1), linear: scale('linear'), gamma: scale('gamma') };
}

async function mashToMax(page: Page): Promise<void> {
  await expect.poll(() => boostPhase(page), { timeout: 10000 }).toBe('live');
  await mash(page, { mode: 'keys', pupils: [0, 1, 2, 3], ms: 15000, untilNotLive: true });
  await expect.poll(() => boostFlow(page), { timeout: 30000 }).toBe('done');
  await page.waitForTimeout(300);
}

async function toRound(page: Page, round: number): Promise<void> {
  await startGame(page, { count: 4, boost: { autoStart: false, seconds: 12, difficulty: 'easy' } });
  for (let current = 1; current < round; current++) {
    await passAll(page, 4);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Skip boost round' }).click();
    await nextButton(page).click();
  }
  await passAll(page, 4);
  await page.waitForTimeout(400);
}

const cases = [
  { name: 'Warp Drive MAX (flare, shockwave ring, shake, zoom-blur tunnel, HYPERSPACE card, arrival)', round: 2 },
  { name: 'placeholder theme MAX (star burst, confetti, glitter rain)', round: 1 },
];
for (const { name, round } of cases) {
  test(`flash safety: ${name} has at most one large luminance flash in any second`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await toRound(page, round);
    await page.getByRole('button', { name: 'Boost round!' }).click();
    const result = await measure(page, () => mashToMax(page));
    const summary = `${result.frames} frames in ${result.seconds} s (${result.fps} fps); linear luminance: max frame-to-frame jump ${result.linear.maxJump}, ${result.linear.largeJumps} large flashes, worst ${result.linear.worstPerSecond}/s; gamma luma: max jump ${result.gamma.maxJump}, ${result.gamma.largeJumps} large flashes, worst ${result.gamma.worstPerSecond}/s`;
    console.log(`FLASH ${name}: ${summary}`);
    test.info().annotations.push({ type: 'flash', description: summary });
    expect(result.fps).toBeGreaterThanOrEqual(25);
    expect(result.linear.worstPerSecond).toBeLessThanOrEqual(1);
    expect(result.gamma.worstPerSecond).toBeLessThanOrEqual(1);
    expect(result.gamma.maxJump).toBeLessThan(THRESHOLD);
  });
}
