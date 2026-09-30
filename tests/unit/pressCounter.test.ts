import { describe, expect, it } from 'vitest';
import type { Pair } from '../../src/input/normalize';
import { BOUNCE_MS, PressCounter } from '../../src/input/pressCounter';

const off: Pair = [false, false], left: Pair = [true, false], right: Pair = [false, true], both: Pair = [true, true];

function counter(players = 1): PressCounter {
  const value = new PressCounter(players);
  value.sample(Array.from({ length: players }, () => off), 0);
  return value;
}

describe('boost press counter', () => {
  it('counts one press per released-to-pressed edge', () => {
    const presses = counter();
    expect(presses.sample([left], 100)).toEqual([{ pupil: 0, side: 0 }]);
    presses.sample([off], 200);
    expect(presses.sample([left], 300)).toEqual([{ pupil: 0, side: 0 }]);
  });

  it('counts a held switch once, however long it is held', () => {
    const presses = counter();
    expect(presses.sample([left], 100)).toHaveLength(1);
    for (let time = 116; time < 5000; time += 16) expect(presses.sample([left], time)).toEqual([]);
  });

  it('ignores contact bounce within 35 ms of the release and accepts a real press after it', () => {
    const presses = counter();
    expect(presses.sample([left], 100)).toHaveLength(1);
    presses.sample([off], 116);
    expect(presses.sample([left], 133)).toEqual([]);
    presses.sample([off], 150);
    expect(presses.sample([left], 166)).toEqual([]);
    presses.sample([off], 183);
    expect(presses.sample([left], 183 + BOUNCE_MS)).toEqual([{ pupil: 0, side: 0 }]);
  });

  it('counts both switches of a pupil and alternating channels independently', () => {
    const presses = counter();
    expect(presses.sample([left], 100)).toEqual([{ pupil: 0, side: 0 }]);
    expect(presses.sample([both], 150)).toEqual([{ pupil: 0, side: 1 }]);
    expect(presses.sample([right], 200)).toEqual([]);
    expect(presses.sample([off], 250)).toEqual([]);
    expect(presses.sample([right], 300)).toEqual([{ pupil: 0, side: 1 }]);
    expect(presses.sample([left], 350)).toEqual([{ pupil: 0, side: 0 }]);
    expect(presses.sample([right], 400)).toEqual([{ pupil: 0, side: 1 }]);
  });

  it('processes pupils independently in the same sample and never lets one block another', () => {
    const presses = counter(4);
    expect(presses.sample([left, right, both, off], 100)).toEqual([{ pupil: 0, side: 0 }, { pupil: 1, side: 1 }, { pupil: 2, side: 0 }, { pupil: 2, side: 1 }]);
    expect(presses.sample([left, off, both, right], 150)).toEqual([{ pupil: 3, side: 1 }]);
    presses.sample([off, off, off, off], 200);
    expect(presses.sample([left, off, off, off], 300)).toEqual([{ pupil: 0, side: 0 }]);
  });

  it('is not slowed by a long held switch on another pupil', () => {
    const presses = counter(2);
    presses.sample([left, off], 100);
    const counted: number[] = [];
    for (let time = 120; time < 1000; time += 100) {
      counted.push(...presses.sample([left, right], time).map(press => press.pupil));
      counted.push(...presses.sample([left, off], time + 50).map(press => press.pupil));
    }
    expect(counted.filter(pupil => pupil === 1)).toHaveLength(9);
    expect(counted.filter(pupil => pupil === 0)).toHaveLength(0);
  });

  it('treats keyboard autorepeat, which keeps the key down, as one press', () => {
    const presses = counter();
    const total = [100, 130, 160, 190, 520, 550, 580].flatMap(time => presses.sample([left], time));
    expect(total).toHaveLength(1);
  });

  it('does not count a switch already held when counting starts until it is released and pressed again', () => {
    const presses = new PressCounter(2);
    expect(presses.sample([left, off], 0)).toEqual([]);
    expect(presses.sample([left, off], 100)).toEqual([]);
    expect(presses.sample([off, left], 200)).toEqual([{ pupil: 1, side: 0 }]);
    presses.sample([off, off], 300);
    expect(presses.sample([left, off], 400)).toEqual([{ pupil: 0, side: 0 }]);
  });

  it('reset re-primes so a switch held across the reset is not a press', () => {
    const presses = counter();
    presses.sample([left], 100);
    presses.reset();
    expect(presses.sample([left], 200)).toEqual([]);
    expect(presses.sample([left], 300)).toEqual([]);
    presses.sample([off], 400);
    expect(presses.sample([left], 500)).toEqual([{ pupil: 0, side: 0 }]);
  });

  it('ignores pupils it was not created for', () => {
    const presses = counter(1);
    expect(presses.sample([off, left, right], 100)).toEqual([]);
  });
});
