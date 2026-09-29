export interface Device { index: number; id: string; buttons: boolean[]; mapping: string; values: number[]; axes: number[] }
export interface Binding { device: number; id: string; button: number }
export function readDevices(): { devices: Device[]; error: string } {
  if (!navigator.getGamepads) return { devices: [], error: 'Controller access is unavailable in this browser. Use current Edge or Chrome, or choose keyboard and touch.' };
  try {
    return { devices: Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => !!pad && pad.connected)
      .map(pad => ({ index: pad.index, id: pad.id, buttons: pad.buttons.map(button => button.pressed), mapping: pad.mapping, values: pad.buttons.map(button => button.value), axes: [...pad.axes] })), error: '' };
  } catch {
    return { devices: [], error: 'This browser has blocked controller access. Check school browser policy, or choose keyboard and touch.' };
  }
}
export const channel = (binding: Binding): string => `${binding.device}:${binding.button}`;
export const down = (binding: Binding | null, devices: Device[]): boolean => !!binding &&
  !!devices.find(device => device.index === binding.device && device.id === binding.id)?.buttons[binding.button];

export class Calibration {
  private releasedAt: number | null = null;
  private candidate: Binding | null = null;
  private stage: 'release' | 'press' | 'finish' = 'release';
  message = 'Release every switch to begin.';
  sample(devices: Device[], used: Binding[], now: number): Binding | null {
    if (this.candidate && !devices.some(device => device.index === this.candidate!.device && device.id === this.candidate!.id)) {
      this.candidate = null; this.stage = 'release'; this.releasedAt = null;
      this.message = 'Controller disconnected. Reconnect it and release every switch to try again.';
      return null;
    }
    const pressed = devices.flatMap(device => device.buttons.flatMap((active, button) => active ? [{ device: device.index, id: device.id, button }] : []));
    if (this.stage === 'release') {
      if (pressed.length) this.releasedAt = null;
      else {
        this.releasedAt ??= now;
        if (now - this.releasedAt >= 100) { this.stage = 'press'; this.message = 'Press one switch, then release it.'; }
      }
    } else if (this.stage === 'press' && pressed.length) {
      const match = used.find(binding => channel(binding) === channel(pressed[0]));
      const differentDevice = used.length > 0 && (used[0].device !== pressed[0].device || used[0].id !== pressed[0].id);
      if (pressed.length !== 1 || match || differentDevice) {
        this.message = match ? 'That button is already assigned. Release it and use a different switch.' : differentDevice ? 'Use the same shared controller for every player. Release and try again.' : 'Several buttons appeared. Release all switches and press only one.';
        this.stage = 'release'; this.releasedAt = null;
      } else { this.candidate = pressed[0]; this.stage = 'finish'; this.message = 'Now release that switch.'; this.releasedAt = null; }
    } else if (this.stage === 'finish') {
      if (pressed.some(binding => channel(binding) !== channel(this.candidate!))) {
        this.stage = 'release'; this.candidate = null; this.releasedAt = null;
        this.message = 'Several buttons appeared. Release all switches and try again.';
      } else if (!pressed.length) {
        this.releasedAt ??= now;
        if (now - this.releasedAt >= 100) return this.candidate;
      } else this.releasedAt = null;
    }
    return null;
  }
}

export class ConnectionHistory {
  private previous: Device[] = [];
  readonly entries: string[] = [];
  sample(devices: Device[], now: number): void {
    const same = (a: Device, b: Device) => a.index === b.index && a.id === b.id;
    const stamp = `${Math.floor(now / 1000)}s`;
    for (const device of this.previous) {
      if (!devices.some(current => same(current, device))) this.entries.unshift(`${stamp} · Slot ${device.index}: no longer reported (${device.id})`);
    }
    for (const device of devices) {
      if (!this.previous.some(previous => same(previous, device))) this.entries.unshift(`${stamp} · Slot ${device.index}: detected (${device.id})`);
    }
    this.entries.splice(12);
    this.previous = devices;
  }
}

export function describeDevice(device: Device): string {
  return `Controller slot ${device.index}: ${device.id}
Mapping: ${device.mapping || 'not standard'} · ${device.buttons.length} buttons · ${device.axes.length} axes
Buttons pressed: ${device.buttons.flatMap((pressed, i) => pressed ? [i] : []).join(', ') || 'none'}
Button values: ${device.values.map((value, i) => `${i}: ${value.toFixed(2)}`).join(' · ') || 'none'}
Raw axes (diagnostic only): ${device.axes.map((value, i) => `${i}: ${value.toFixed(2)}`).join(' · ') || 'none'}`;
}
