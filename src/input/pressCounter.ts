import type { Side } from '../game/questions';
import type { Pair } from './normalize';

export interface Press { pupil: number; side: Side }
export const BOUNCE_MS = 35;
interface Channel { down: boolean; releasedAt: number }

// Boost rounds only: reports each released-to-pressed edge on either switch of every pupil.
// A held switch is one press, and a press within BOUNCE_MS of that same switch being released is contact chatter, not a press. It knows nothing of
// answer cooldowns and is never read by InputFilter, so mashing here cannot answer a maths question.
export class PressCounter {
  private channels: Channel[][];
  private primed = false;
  constructor(players: number, private bounceMs = BOUNCE_MS) {
    this.channels = Array.from({ length: players }, () => [{ down: false, releasedAt: -Infinity }, { down: false, releasedAt: -Infinity }]);
  }
  // The next sample only records what is down: a switch already held when counting (re)starts is not a press until it has been released and pressed again.
  reset(): void { this.primed = false; }
  sample(states: Pair[], now: number): Press[] {
    const presses: Press[] = [];
    const first = !this.primed;
    this.primed = true;
    this.channels.forEach((pair, pupil) => pair.forEach((channel, side) => {
      const down = states[pupil]?.[side] ?? false;
      if (first) channel.releasedAt = down ? Infinity : -Infinity;
      else if (down && !channel.down && now - channel.releasedAt >= this.bounceMs) presses.push({ pupil, side: side as Side });
      else if (!down && channel.down) channel.releasedAt = now;
      channel.down = down;
    }));
    return presses;
  }
}
