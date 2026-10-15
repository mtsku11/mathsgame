import { describe, expect, it, vi } from 'vitest';
import { newRoomCode, padUrl, relayFrom, RELAY, ROOM_ALPHABET, STALE_MS, TabletLink } from '../../src/input/tablets';
import { parseJoin, ROOM_PATTERN } from '../../relay/src/join';

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  receive(message: object): void { this.onmessage?.({ data: JSON.stringify(message) }); }
}
function link(): { tablets: TabletLink; socket: () => FakeSocket; clock: { now: number } } {
  const clock = { now: 0 };
  const sockets: FakeSocket[] = [];
  const tablets = new TabletLink('ws://127.0.0.1:8787', 'K7M2QX9P', player => ({ caps: [null, { fill: `#${player}`, ink: '#fff' }] }), () => clock.now,
    url => { const socket = new FakeSocket(url); sockets.push(socket); return socket as unknown as WebSocket; });
  tablets.connect();
  return { tablets, socket: () => sockets.at(-1)!, clock };
}
const press = (socket: FakeSocket, player: number, b: [number, number]): void => socket.receive({ t: 'pad', p: player, m: JSON.stringify({ b }) });

describe('tablet switches', () => {
  it('room codes use only unambiguous letters and digits, and the relay accepts them', () => {
    for (let i = 0; i < 50; i++) {
      const code = newRoomCode();
      expect(code).toMatch(ROOM_PATTERN);
      expect([...code].every(letter => ROOM_ALPHABET.includes(letter))).toBe(true);
    }
    expect(ROOM_ALPHABET).not.toMatch(/[IL0O1]/);
  });
  it('joins as the host, and a tablet that joins is connected and is sent its button colours', () => {
    const { tablets, socket } = link();
    expect(socket().url).toBe('ws://127.0.0.1:8787/room/K7M2QX9P?role=host');
    expect(tablets.connected()).toEqual([false, false, false, false]);
    socket().receive({ t: 'join', p: 1 });
    expect(tablets.connected()).toEqual([false, true, false, false]);
    expect(JSON.parse(socket().sent[0])).toEqual({ to: 1, m: JSON.stringify({ t: 'look', caps: [null, { fill: '#1', ink: '#fff' }] }) });
  });
  it('a press and release that both arrive between two frames still reach the game as one press', () => {
    const { tablets, socket } = link();
    socket().receive({ t: 'pads', players: [0, 2] });
    press(socket(), 2, [0, 1]); press(socket(), 2, [0, 0]);
    expect(tablets.read()[2]).toEqual([false, true]);
    expect(tablets.read()[2]).toEqual([false, false]);
    press(socket(), 0, [1, 0]);
    expect(tablets.read()[0]).toEqual([true, false]);
    expect(tablets.read()[0]).toEqual([true, false]);
  });
  it('a tablet that goes quiet or leaves counts as gone, with its buttons released', () => {
    const { tablets, socket, clock } = link();
    socket().receive({ t: 'join', p: 0 }); socket().receive({ t: 'join', p: 3 });
    press(socket(), 0, [1, 0]); press(socket(), 3, [0, 1]);
    clock.now = STALE_MS - 1;
    press(socket(), 3, [0, 1]);
    expect(tablets.connected()).toEqual([true, false, false, true]);
    clock.now = STALE_MS + 1;
    expect(tablets.connected()).toEqual([false, false, false, true]);
    expect(tablets.read()[0]).toEqual([false, false]);
    socket().receive({ t: 'leave', p: 3 });
    expect(tablets.connected()[3]).toBe(false);
    expect(tablets.read()[3]).toEqual([false, false]);
  });
  it('ignores malformed relay messages', () => {
    const { tablets, socket } = link();
    socket().onmessage?.({ data: 'not json' });
    socket().receive({ t: 'pad', p: 9, m: JSON.stringify({ b: [1, 1] }) });
    socket().receive({ t: 'pad', p: 1, m: '{' });
    socket().receive({ t: 'pad', p: 1, m: JSON.stringify({ b: [1] }) });
    expect(tablets.connected()).toEqual([false, false, false, false]);
  });
  it('reconnects after the relay drops, and forgets which tablets were there until the relay says again', () => {
    vi.useFakeTimers();
    const { tablets, socket } = link();
    socket().receive({ t: 'join', p: 0 });
    const first = socket();
    first.close();
    expect(tablets.connected()[0]).toBe(false);
    vi.advanceTimersByTime(500);
    expect(socket()).not.toBe(first);
    socket().receive({ t: 'pads', players: [0] });
    expect(tablets.connected()[0]).toBe(true);
    tablets.close();
    vi.advanceTimersByTime(10000);
    vi.useRealTimers();
  });
  it('a second game window on the same room takes the tablets, and this one stops reconnecting', () => {
    vi.useFakeTimers();
    const { tablets, socket } = link();
    const first = socket();
    first.readyState = 3;
    first.onclose?.({ code: 4000 });
    vi.advanceTimersByTime(10000);
    expect(socket()).toBe(first);
    expect(tablets.replaced).toBe(true);
    vi.useRealTimers();
  });
  it('tablet links carry the room and player, and only a local relay can replace the published one', () => {
    expect(padUrl('https://mtsku11.github.io/mathsgame/', RELAY, 'K7M2QX9P', 1)).toBe('https://mtsku11.github.io/mathsgame/pad.html#K7M2QX9P-2');
    expect(padUrl('http://127.0.0.1:4173/?relay=x', 'ws://127.0.0.1:8787', 'K7M2QX9P', 0)).toBe('http://127.0.0.1:4173/pad.html?relay=ws%3A%2F%2F127.0.0.1%3A8787#K7M2QX9P-1');
    expect(relayFrom('?relay=ws://127.0.0.1:8787')).toBe('ws://127.0.0.1:8787');
    expect(relayFrom('?relay=wss://evil.example')).toBe(RELAY);
    expect(relayFrom('')).toBe(RELAY);
  });
  it('the relay admits the host and one pad per player from the published game or local development only', () => {
    const url = (path: string): URL => new URL(`https://relay.example${path}`);
    const site = 'https://mtsku11.github.io';
    expect(parseJoin(url('/room/K7M2QX9P?role=host'), site)).toEqual({ room: 'K7M2QX9P', role: 'host' });
    expect(parseJoin(url('/room/K7M2QX9P?role=pad&player=3'), 'http://127.0.0.1:4173')).toEqual({ room: 'K7M2QX9P', role: 'pad', player: 3 });
    expect(parseJoin(url('/room/K7M2QX9P?role=pad&player=4'), site)).toBeNull();
    expect(parseJoin(url('/room/K7M2QX9P?role=pad&player='), site)).toBeNull();
    expect(parseJoin(url('/room/K7M2QX9P?role=pad'), site)).toBeNull();
    expect(parseJoin(url('/room/K7M2QX9O?role=host'), site)).toBeNull();
    expect(parseJoin(url('/room/K7M2QX9P?role=host'), 'https://evil.example')).toBeNull();
    expect(parseJoin(url('/room/K7M2QX9P?role=host'), null)).toBeNull();
    expect(parseJoin(url('/'), site)).toBeNull();
  });
});
