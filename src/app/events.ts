import type { Question, Side } from '../game/questions';

export type BoostTheme = 'fireworkFrenzy' | 'warpDrive' | 'bubbleBlast';
export type BoostTier = 1 | 2 | 3;
export interface GameEvents {
  answerCorrect: { player: number; side: Side };
  answerTry: { player: number; side: Side };
  // count is how many objects the helper numbers run to.
  // narrated: the count will be spoken, and helpCount marks each number as it is said.
  turnHelped: { player: number; count: number; narrated: boolean };
  helpCount: { player: number; n: number };
  turnPassed: { player: number };
  roundReady: { round: number };
  roundStart: { round: number };
  boostStart: { round: number; theme: BoostTheme };
  boostGo: void;
  boostPress: { player: number; side: Side };
  boostTier: { tier: BoostTier };
  boostFinale: { tier: BoostTier };
  boostEnd: { tier: BoostTier };
  destinationReached: { destination: 0 | 1 | 2 };
  missionComplete: { stars: number };
  boostCount: { n: 1 | 2 | 3 };
  // The Warp Drive finale after round 6 has reached home; destinationReached covers every other arrival.
  homeReached: void;
  starLanded: void;
  switchChecked: { player: number; side: Side };
  // Both of a pilot's switches have been pressed and released on the check-in screen.
  crewReady: { player: number };
  // The teacher started the mission from check-in.
  crewStart: void;
  // auto: read at the start of a Spotlight turn, so low stimulation silences it; the teacher's "Say it" is not auto.
  sayQuestion: { player: number; question: Question; auto?: boolean };
  screen: { name: 'title' | 'setup' | 'switches' | 'checkin' | 'play' | 'finale' };
  gamePaused: void;
  gameResumed: void;
  uiClick: void;
}

type Handler<T> = (payload: T) => void;
type Payload<T> = [T] extends [void] ? [] : [T];
export interface EventBus<E> {
  on<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void;
  off<K extends keyof E>(name: K, handler: Handler<E[K]>): void;
  emit<K extends keyof E>(name: K, ...payload: Payload<E[K]>): void;
}

export function createBus<E>(): EventBus<E> {
  const handlers = new Map<keyof E, Set<Handler<never>>>();
  const off = <K extends keyof E>(name: K, handler: Handler<E[K]>): void => { handlers.get(name)?.delete(handler as Handler<never>); };
  return {
    on(name, handler) {
      const set = handlers.get(name) ?? new Set();
      set.add(handler as Handler<never>);
      handlers.set(name, set);
      return () => off(name, handler);
    },
    off,
    emit(name, ...payload) {
      for (const handler of [...handlers.get(name) ?? []]) {
        try { (handler as Handler<unknown>)(payload[0]); } catch (error) { console.error(`Event handler for "${String(name)}" failed`, error); }
      }
    },
  };
}

export const events = createBus<GameEvents>();
