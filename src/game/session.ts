import { question, type Preset, type Question, type Side } from './questions';

export interface Turn { question: Question; outcome: 'waiting' | 'correct' | 'passed'; attempts: number; supported: boolean }
export interface Session { round: number; turns: Turn[]; stars: number; active: number; history: Turn[][]; finished: boolean }
export function newTurns(presets: Preset[], random: () => number, previous?: Turn[]): Turn[] {
  return presets.map((preset, i) => ({ question: question(preset, random, previous?.[i].question.signature), outcome: 'waiting', attempts: 0, supported: false }));
}
export function createSession(presets: Preset[], random: () => number): Session {
  return { round: 1, turns: newTurns(presets, random), stars: 0, active: 0, history: [], finished: false };
}
export function answer(session: Session, pupil: number, side: Side): boolean {
  const turn = session.turns[pupil];
  if (session.finished || !turn || turn.outcome !== 'waiting') return false;
  turn.attempts++;
  if (side !== turn.question.correct) return false;
  turn.outcome = 'correct';
  session.stars++;
  return true;
}
export function pass(session: Session, pupil: number): void {
  if (session.turns[pupil]?.outcome === 'waiting') session.turns[pupil].outcome = 'passed';
}
export const ready = (session: Session): boolean => session.turns.every(turn => turn.outcome !== 'waiting');
export function advance(session: Session, presets: Preset[], random: () => number, enlarged: boolean): boolean {
  if (session.finished) return false;
  if (enlarged && session.active < session.turns.length - 1) {
    if (session.turns[session.active].outcome === 'waiting') return false;
    session.active++;
    return true;
  }
  if (!ready(session)) return false;
  session.history.push(session.turns.map(turn => ({ ...turn })));
  if (session.round === 6) session.finished = true;
  else {
    session.round++;
    session.active = 0;
    session.turns = newTurns(presets, random, session.turns);
  }
  return true;
}
