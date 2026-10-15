import type { Pair } from './normalize';

// Tablet switches: each pupil's tablet shows two big buttons (pad.html) and reaches the classroom screen through a small relay (relay/).
// The relay only passes button states between the screen and the tablets of one room; the room code lives only in this browser tab.
export const RELAY = 'wss://number-crew-relay.marcscullymail.workers.dev';
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// A tablet that has sent nothing for this long counts as gone and its buttons as released; tablets report their buttons every second.
export const STALE_MS = 3000;

// The switch-cap colours the teacher chose for this pupil, so the tablet's buttons match the station's answer buttons.
export interface PadLook { caps: ({ fill: string; ink: string } | null)[] }
interface Pad { joined: boolean; last: number; state: Pair; latched: Pair }

export function newRoomCode(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), value => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}
// Tests point the game at a local relay with ?relay=ws://127.0.0.1:8787; nothing else may replace the published relay.
export function relayFrom(search: string): string {
  const asked = new URLSearchParams(search).get('relay');
  return asked && /^ws:\/\/(127\.0\.0\.1|localhost):\d+$/.test(asked) ? asked : RELAY;
}
export function padUrl(page: string, relay: string, room: string, player: number): string {
  const url = new URL('pad.html', page);
  url.search = relay === RELAY ? '' : `?relay=${encodeURIComponent(relay)}`;
  url.hash = `${room}-${player + 1}`;
  return url.href;
}

export class TabletLink {
  private socket: WebSocket | null = null;
  private retry = 0;
  private closed = false;
  // Another game window opened the same room (a duplicated tab copies the room); it keeps the tablets until this page reloads.
  replaced = false;
  private pads: Pad[] = Array.from({ length: 4 }, () => ({ joined: false, last: -Infinity, state: [false, false], latched: [false, false] }));
  constructor(readonly relay: string, readonly room: string, private look: (player: number) => PadLook,
    private now: () => number = () => performance.now(), private open: (url: string) => WebSocket = url => new WebSocket(url)) {}

  connect(): void {
    if (this.closed || this.socket) return;
    const socket = this.open(`${this.relay}/room/${this.room}?role=host`);
    this.socket = socket;
    socket.onopen = () => { this.retry = 0; };
    socket.onmessage = event => this.receive(String(event.data));
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.pads.forEach(pad => { pad.joined = false; });
      if (event.code === 4000) { this.replaced = true; return; }
      if (!this.closed) setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.retry++));
    };
  }
  close(): void { this.closed = true; this.socket?.close(); this.socket = null; }
  // Sends every joined tablet its pilot's name and colours, so each tablet matches its station on the screen.
  sendLooks(): void { this.pads.forEach((pad, player) => { if (pad.joined) this.sendLook(player); }); }
  online(): boolean { return this.socket?.readyState === WebSocket.OPEN; }
  connected(): boolean[] { const now = this.now(); return this.pads.map(pad => pad.joined && now - pad.last < STALE_MS); }
  // The buttons as the game should see them this frame. A press and release that both arrived since the last frame still counts as one press.
  read(): Pair[] {
    const live = this.connected();
    return this.pads.map((pad, player) => {
      if (!live[player]) { pad.state = [false, false]; pad.latched = [false, false]; return [false, false]; }
      const seen: Pair = [pad.state[0] || pad.latched[0], pad.state[1] || pad.latched[1]];
      pad.latched = [false, false];
      return seen;
    });
  }

  private sendLook(player: number): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ to: player, m: JSON.stringify({ t: 'look', ...this.look(player) }) }));
  }
  private receive(data: string): void {
    let message: { t?: string; p?: number; players?: number[]; m?: string };
    try { message = JSON.parse(data); } catch { return; }
    const pad = Number.isInteger(message.p) ? this.pads[message.p!] : undefined;
    if (message.t === 'pads' && Array.isArray(message.players)) {
      this.pads.forEach((each, player) => { each.joined = message.players!.includes(player); if (each.joined) each.last = this.now(); });
      this.sendLooks();
    } else if (message.t === 'join' && pad) { pad.joined = true; pad.last = this.now(); this.sendLook(message.p!); }
    else if (message.t === 'leave' && pad) { pad.joined = false; pad.state = [false, false]; pad.latched = [false, false]; }
    else if (message.t === 'pad' && pad && typeof message.m === 'string') {
      let state: unknown;
      try { state = (JSON.parse(message.m) as { b?: unknown }).b; } catch { return; }
      if (!Array.isArray(state) || state.length !== 2) return;
      pad.joined = true; pad.last = this.now();
      pad.state = [state[0] === 1, state[1] === 1];
      if (pad.state[0]) pad.latched[0] = true;
      if (pad.state[1]) pad.latched[1] = true;
    }
  }
}
