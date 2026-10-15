import '@fontsource/titan-one/latin-400.css';
import '@fontsource/baloo-2/latin-700.css';
import './pad.css';
import { icons } from '../ui/art/icons';
import { pilot, pilotColors } from '../ui/art/pilot';
import { relayFrom, ROOM_ALPHABET } from '../input/tablets';

// One pupil's tablet: two big buttons that act as that pupil's left and right switches on the classroom screen.
// It reports its buttons on every change and once a second, so the screen can tell a tablet that has gone quiet from one with nothing pressed.
const root = document.querySelector<HTMLDivElement>('#pad')!;
const relay = relayFrom(location.search);
const sideNames = ['Left', 'Right'] as const;
const clean = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
const validRoom = (code: string): boolean => code.length === 8 && [...code].every(letter => ROOM_ALPHABET.includes(letter));

function joinForm(message = ''): void {
  root.innerHTML = `<main class="pj"><h1>Number Crew tablet</h1>
<p>Scan your player’s code on the classroom screen with this tablet’s camera, or type the room code shown there.</p>
<form class="pj-form"><label>Room code<input id="room" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="11" inputmode="text"></label>
<fieldset><legend>Player</legend>${[1, 2, 3, 4].map(n => `<label class="pj-player" style="--pc:${pilotColors[n - 1].color}"><input type="radio" name="player" value="${n}" ${n === 1 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
<p class="pj-error" role="alert">${message}</p><button type="submit">Join</button></form></main>`;
  root.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault();
    const room = clean(root.querySelector<HTMLInputElement>('#room')!.value);
    const player = Number(root.querySelector<HTMLInputElement>('input[name="player"]:checked')!.value);
    if (!validRoom(room)) { joinForm('That code is not right. It has 8 letters and numbers, like K7M2 QX9P.'); return; }
    location.hash = `${room}-${player}`;
  });
}

let stop: (() => void) | null = null;
function padView(room: string, player: number): void {
  const { color, light, name } = pilotColors[player];
  root.innerHTML = `<main class="pad" style="--pc:${color};--pl:${light}">
<header class="pad-bar"><span class="pad-pilot">${pilot(player, 'idle', 64)}</span><span class="pad-who">Player ${player + 1}<small>${name}</small></span><span class="pad-status" role="status">Connecting…</span></header>
<div class="pad-buttons">${[0, 1].map(side => `<button type="button" class="pad-btn" data-side="${side}" aria-label="${sideNames[side]} answer">${side ? icons.chevR(120) : icons.chevL(120)}<span>${sideNames[side]}</span></button>`).join('')}</div>
<button type="button" class="pad-retake" hidden>Use this tablet for Player ${player + 1}</button></main>`;
  const pad = root.querySelector<HTMLElement>('.pad')!;
  const status = root.querySelector<HTMLElement>('.pad-status')!;
  const retake = root.querySelector<HTMLButtonElement>('.pad-retake')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('.pad-btn')];
  const held: [boolean, boolean] = [false, false];
  let socket: WebSocket | null = null, retry = 0, timer = 0, beat = 0, taken = false;
  const say = (text: string, live: boolean): void => { status.textContent = text; pad.classList.toggle('is-live', live); };
  const report = (): void => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ b: held.map(Number) })); };
  const set = (side: number, down: boolean): void => {
    if (held[side] === down) return;
    held[side] = down;
    buttons[side].classList.toggle('is-down', down);
    if (down) navigator.vibrate?.(15);
    report();
  };
  const releaseAll = (): void => { set(0, false); set(1, false); };
  function connect(): void {
    socket = new WebSocket(`${relay}/room/${room}?role=pad&player=${player}`);
    const mine = socket;
    mine.onopen = () => { retry = 0; report(); };
    mine.onmessage = event => {
      let message: { t?: string; on?: boolean; caps?: ({ fill: string; ink: string } | null)[] };
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.t === 'host') say(message.on ? 'Connected to the game' : 'Waiting for the classroom screen', !!message.on);
      if (message.t === 'look') buttons.forEach((button, side) => {
        const cap = message.caps?.[side];
        button.style.setProperty('--cap', cap?.fill ?? ''); button.style.setProperty('--ink', cap?.ink ?? '');
        button.classList.toggle('has-cap', !!cap);
      });
    };
    mine.onclose = event => {
      if (socket !== mine) return;
      socket = null;
      if (event.code === 4000) { taken = true; say(`Another tablet is now Player ${player + 1}`, false); retake.hidden = false; return; }
      say('No connection. Trying again…', false);
      timer = window.setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
    };
  }
  buttons.forEach((button, side) => {
    button.addEventListener('pointerdown', event => { button.setPointerCapture(event.pointerId); set(side, true); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) button.addEventListener(type, () => set(side, false));
    // Keyboard, switch access and screen readers activate with a click and no pointer: that is one short press.
    button.addEventListener('click', event => { if (event.detail === 0) { set(side, true); window.setTimeout(() => set(side, false), 150); } });
  });
  retake.addEventListener('click', () => { retake.hidden = true; taken = false; say('Connecting…', false); connect(); });
  root.addEventListener('contextmenu', event => event.preventDefault());
  // A tablet waking from sleep reconnects at once instead of waiting out its retry delay.
  const onHidden = (): void => {
    if (document.hidden) { releaseAll(); return; }
    void keepAwake();
    if (!socket && !taken) { clearTimeout(timer); retry = 0; connect(); }
  };
  document.addEventListener('visibilitychange', onHidden);
  beat = window.setInterval(report, 1000);
  connect();
  void keepAwake();
  stop = () => { taken = true; clearTimeout(timer); clearInterval(beat); document.removeEventListener('visibilitychange', onHidden); const last = socket; socket = null; last?.close(); };
}

// Tablets that dim or lock drop off the game; ask the screen to stay on where the browser allows it.
async function keepAwake(): Promise<void> {
  try { await navigator.wakeLock?.request('screen'); } catch { /* not allowed here; the tablet's own display settings apply */ }
}

function route(): void {
  stop?.(); stop = null;
  const match = /^#([A-Za-z0-9]{8})-([1-4])$/.exec(location.hash);
  const room = match ? clean(match[1]) : '';
  if (match && validRoom(room)) padView(room, Number(match[2]) - 1); else joinForm(location.hash.length > 1 ? 'That link is not complete. Type the room code instead.' : '');
}
window.addEventListener('hashchange', route);
route();
