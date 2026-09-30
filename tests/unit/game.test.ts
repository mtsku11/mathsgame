import { describe, expect, it } from 'vitest';
import { question, seededRandom, type Preset } from '../../src/game/questions';
import { createSession, answer, advance, pass, ready } from '../../src/game/session';

describe('maths questions', () => {
  for (const preset of ['count', 'add5', 'add10'] as Preset[]) {
    it(`${preset}: valid quantities, distinct options, no repeats, both sides`, () => {
      const random = seededRandom(123);
      let previous: string | undefined;
      let left = 0;
      for (let n = 0; n < 2000; n++) {
        const q = question(preset, random, previous);
        expect(q.signature).not.toBe(previous);
        expect(q.choices[0]).not.toBe(q.choices[1]);
        expect(q.choices[q.correct]).toBe(q.groups.reduce((a, b) => a + b, 0));
        expect(q.groups.every(value => Number.isInteger(value) && value >= 1)).toBe(true);
        expect(q.choices.every(value => value >= 1 && value <= (preset === 'add10' ? 10 : 5))).toBe(true);
        previous = q.signature; left += q.correct === 0 ? 1 : 0;
      }
      expect(left).toBeGreaterThan(800); expect(left).toBeLessThan(1200);
    });
  }
  it('is deterministic', () => { expect(question('add10', seededRandom(1))).toEqual(question('add10', seededRandom(1))); });
});

describe('cooperative journey', () => {
  it('retries/help earn once, pass resolves without a star, six rounds finish', () => {
    const presets: Preset[] = ['count', 'add5', 'add10', 'count'];
    const random = seededRandom(8), session = createSession(presets, random);
    for (let round = 1; round <= 6; round++) {
      expect(advance(session, presets, random, false)).toBe(false);
      const correct = session.turns[0].question.correct;
      answer(session, 0, correct === 0 ? 1 : 0);
      expect(session.turns[0].outcome).toBe('waiting');
      session.turns[0].supported = true;
      answer(session, 0, correct); answer(session, 0, correct);
      pass(session, 1); pass(session, 1);
      answer(session, 2, session.turns[2].question.correct);
      answer(session, 3, session.turns[3].question.correct);
      expect(ready(session)).toBe(true);
      expect(session.stars).toBe(round * 3);
      advance(session, presets, random, false);
    }
    expect(session.finished).toBe(true); expect(session.history).toHaveLength(6);
    expect(session.history[0][0].attempts).toBe(2);
    expect(advance(session, presets, random, false)).toBe(false);
  });
  it('enlarged turns move only after resolution and keep same round', () => {
    const presets: Preset[] = ['count', 'count', 'count'];
    const random = seededRandom(9), session = createSession(presets, random);
    expect(advance(session, presets, random, true)).toBe(false);
    pass(session, 0); advance(session, presets, random, true);
    expect(session.active).toBe(1); expect(session.round).toBe(1);
    pass(session, 1); advance(session, presets, random, true);
    pass(session, 2); advance(session, presets, random, true);
    expect(session.active).toBe(0); expect(session.round).toBe(2);
  });
});

describe('one and two player missions', () => {
  for (const count of [1, 2]) {
    it(`${count} player${count > 1 ? 's' : ''} complete six rounds with at most one star per pupil per round`, () => {
      const presets: Preset[] = (['count', 'add5'] as Preset[]).slice(0, count);
      const random = seededRandom(20 + count), session = createSession(presets, random);
      expect(session.turns).toHaveLength(count);
      for (let round = 1; round <= 6; round++) {
        expect(ready(session)).toBe(false);
        for (let pupil = 0; pupil < count; pupil++) {
          const correct = session.turns[pupil].question.correct;
          expect(answer(session, pupil, correct === 0 ? 1 : 0)).toBe(false);
          expect(answer(session, pupil, correct)).toBe(true);
          expect(answer(session, pupil, correct)).toBe(false);
        }
        expect(session.stars).toBe(round * count);
        expect(ready(session)).toBe(true);
        expect(advance(session, presets, random, false)).toBe(true);
      }
      expect(session.finished).toBe(true);
      expect(session.stars).toBe(6 * count);
      expect(session.history).toHaveLength(6);
      for (const turns of session.history) {
        expect(turns).toHaveLength(count);
        expect(turns.filter(turn => turn.outcome === 'correct').length).toBeLessThanOrEqual(count);
        expect(turns.every(turn => turn.attempts === 2)).toBe(true);
      }
      expect(advance(session, presets, random, false)).toBe(false);
    });
  }
  it('a single player who passes every round finishes with no stars', () => {
    const presets: Preset[] = ['count'], random = seededRandom(5), session = createSession(presets, random);
    for (let round = 1; round <= 6; round++) { pass(session, 0); expect(advance(session, presets, random, true)).toBe(true); }
    expect(session.finished).toBe(true); expect(session.stars).toBe(0);
  });
});
