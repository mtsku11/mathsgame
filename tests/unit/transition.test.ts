import { expect, it } from 'vitest';
import { TransitionTimer } from '../../src/game/transition';

it('waits for completion and freezes the remaining delay while paused', () => {
  const timer = new TransitionTimer();
  expect(timer.sample(0, false, true, 4000)).toBe(false);
  expect(timer.sample(10000, true, true, 4000)).toBe(false);
  expect(timer.sample(11000, true, true, 4000)).toBe(false);
  expect(timer.sample(11010, true, false, 4000)).toBe(false);
  expect(timer.sample(30000, true, true, 4000)).toBe(false);
  expect(timer.sample(32999, true, true, 4000)).toBe(false);
  expect(timer.sample(33000, true, true, 4000)).toBe(true);
});
it('manual advancement resets the next round delay', () => {
  const timer = new TransitionTimer();
  timer.sample(0, true, true, 2000); timer.sample(1500, true, true, 2000);
  timer.reset();
  expect(timer.sample(1600, true, true, 2000)).toBe(false);
  expect(timer.sample(3599, true, true, 2000)).toBe(false);
  expect(timer.sample(3600, true, true, 2000)).toBe(true);
});
