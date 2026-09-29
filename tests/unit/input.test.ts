import { describe, expect, it } from 'vitest';
import { InputFilter, type Pair } from '../../src/input/normalize';
import { Calibration, ConnectionHistory, type Device } from '../../src/input/gamepad';

const off: Pair = [false, false], left: Pair = [true, false], right: Pair = [false, true];
describe('per-pupil input', () => {
  it('batches simultaneous pupils, rejects chords, and never repeats holds', () => {
    const filter = new InputFilter([500, 500, 500, 500]);
    filter.sample([off, off, off, off], 0); filter.sample([off, off, off, off], 100);
    expect(filter.sample([left, right, left, [true, true]], 110)).toEqual([{ pupil: 0, side: 0 }, { pupil: 1, side: 1 }, { pupil: 2, side: 0 }]);
    expect(filter.sample([left, right, left, left], 900)).toEqual([]);
  });
  it('discards bounce and cooldown presses instead of queuing', () => {
    const filter = new InputFilter([500]);
    filter.sample([off], 0); filter.sample([off], 100);
    expect(filter.sample([left], 110)).toHaveLength(1);
    filter.sample([off], 120); expect(filter.sample([right], 150)).toEqual([]);
    filter.sample([off], 160); filter.sample([off], 260);
    expect(filter.sample([right], 600)).toEqual([]);
    expect(filter.sample([right], 700)).toEqual([]);
    filter.sample([off], 710); filter.sample([off], 810);
    expect(filter.sample([right], 820)).toEqual([{ pupil: 0, side: 1 }]);
  });
  it('reset blocks held input in next round; one pupil cannot block another', () => {
    const filter = new InputFilter([0, 0]);
    filter.sample([off, off], 0); filter.sample([off, off], 100);
    filter.sample([left, off], 110); filter.reset();
    filter.sample([left, off], 200); filter.sample([left, off], 300);
    expect(filter.sample([left, right], 310)).toEqual([{ pupil: 1, side: 1 }]);
  });
});
describe('calibration', () => {
  const device = (buttons: boolean[]): Device[] => [{ index: 0, id: 'Shared XAC', buttons, mapping: 'standard', values: buttons.map(Number), axes: [] }];
  it('requires release, fresh press and release before accepting a channel', () => {
    const c = new Calibration();
    expect(c.sample(device([true, false]), [], 0)).toBeNull();
    c.sample(device([false, false]), [], 10); c.sample(device([false, false]), [], 110);
    expect(c.sample(device([false, true]), [], 120)).toBeNull();
    c.sample(device([false, false]), [], 150);
    expect(c.sample(device([false, false]), [], 250)).toEqual({ device: 0, id: 'Shared XAC', button: 1 });
  });
  it('rejects duplicate channels and ambiguous multi-button presses', () => {
    const c = new Calibration(), used = [{ device: 0, id: 'Shared XAC', button: 0 }];
    c.sample(device([false, false]), used, 0); c.sample(device([false, false]), used, 100);
    expect(c.sample(device([true, false]), used, 110)).toBeNull(); expect(c.message).toContain('already assigned');
    c.sample(device([false, false]), used, 120); c.sample(device([false, false]), used, 220);
    expect(c.sample(device([true, true]), [], 230)).toBeNull(); expect(c.message).toContain('Several');
  });
});

it('records connection changes without poll duplicates and bounds history', () => {
  const history = new ConnectionHistory();
  const pad: Device = { index: 0, id: 'XAC', buttons: [], mapping: 'standard', values: [], axes: [] };
  history.sample([pad], 0); history.sample([pad], 100);
  expect(history.entries).toHaveLength(1);
  history.sample([], 1000); history.sample([{ ...pad, index: 2 }], 2000);
  expect(history.entries[0]).toContain('Slot 2: detected');
  expect(history.entries[1]).toContain('Slot 0: no longer reported');
  for (let i = 0; i < 20; i++) history.sample(i % 2 ? [pad] : [], i * 1000);
  expect(history.entries).toHaveLength(12);
});

it('does not mistake a disconnected calibration candidate for a released switch', () => {
  const c = new Calibration();
  const pad: Device = { index: 0, id: 'XAC', buttons: [false], mapping: '', values: [0], axes: [1] };
  c.sample([pad], [], 0); c.sample([pad], [], 100);
  c.sample([{ ...pad, buttons: [true] }], [], 110);
  expect(c.sample([], [], 120)).toBeNull();
  expect(c.message).toContain('disconnected');
  expect(c.sample([], [], 300)).toBeNull();
});
