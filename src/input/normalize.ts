import type { Side } from '../game/questions';
export type Pair = [boolean, boolean];
export interface Action { pupil: number; side: Side }
interface Gate { previous: Pair; releasedAt: number | null; armed: boolean; last: number }

export class InputFilter {
  private gates: Gate[];
  constructor(private cooldowns: number[]) {
    this.gates = cooldowns.map(() => ({ previous: [false, false], releasedAt: null, armed: false, last: -Infinity }));
  }
  reset(): void {
    this.gates.forEach(gate => { gate.armed = false; gate.releasedAt = null; });
  }
  sample(states: Pair[], now: number): Action[] {
    const actions: Action[] = [];
    this.gates.forEach((gate, pupil) => {
      const state = states[pupil] ?? [false, false];
      const edges = state.map((down, side) => down && !gate.previous[side]);
      if (!state[0] && !state[1]) {
        gate.releasedAt ??= now;
        if (now - gate.releasedAt >= 100 && now - gate.last >= this.cooldowns[pupil]) gate.armed = true;
      } else {
        gate.releasedAt = null;
        if (gate.armed && now - gate.last >= this.cooldowns[pupil] && !(state[0] && state[1]) && (edges[0] || edges[1])) {
          actions.push({ pupil, side: edges[0] ? 0 : 1 });
          gate.last = now;
        }
        gate.armed = false;
      }
      gate.previous = [...state];
    });
    return actions;
  }
}
