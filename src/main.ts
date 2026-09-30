import '@fontsource/titan-one/latin-400.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './style.css';
import './ui/theme.css';
import { loadSettings, saveSettings } from './settings';
import { seededRandom, type Preset, type Side } from './game/questions';
import { createSession, answer, advance, pass, ready, type Session } from './game/session';
import { createBoostRun } from './app/boostRun';
import { InputFilter, type Pair } from './input/normalize';
import { Calibration, ConnectionHistory, describeDevice, readDevices, down, type Binding, type Device } from './input/gamepad';
import { TransitionTimer } from './game/transition';
import { createAudio } from './audio/audio';
import { registerOffline } from './offline/register';
import { events } from './app/events';
import { createRouter } from './app/router';
import { createTitleScreen } from './ui/screens/title';
import { destinationOf } from './ui/art/planets';
import { createCheckInScreen, type CheckInState } from './ui/screens/checkin';
import { createFinaleScreen, type FinaleState } from './ui/screens/finale';
import { createPlayScreen, type PlayState } from './ui/screens/play';
import { createSetupScreen, type InputMode, type SetupState } from './ui/screens/setup';
import { createSwitchScreen, type SwitchState } from './ui/screens/switches';
import * as arrive from './ui/fx/arrive';
import * as motion from './ui/fx/motion';
import { isCalm, setLowStim, setReducedMotion } from './ui/fx/motion';
import * as particles from './ui/fx/particles';
import * as pixi from './ui/fx/pixi';

const app = document.querySelector<HTMLDivElement>('#app')!;
const announcer = document.createElement('p');
announcer.id = 'game-status';
announcer.className = 'sr-only';
announcer.setAttribute('role', 'status');
announcer.setAttribute('aria-live', 'polite');
announcer.setAttribute('aria-atomic', 'true');
document.body.append(announcer);
const settings = loadSettings();
setReducedMotion(settings.reduced);
setLowStim(settings.lowStim);
document.body.classList.toggle('simple', settings.simple);
const audio = createAudio(settings);
type View = 'setup' | 'controls' | 'checkin' | 'play' | 'results';
const routes = { setup: 'setup', controls: 'switches', checkin: 'checkin', play: 'play', results: 'finale' } as const;
let screen: View = 'setup';
let mode: InputMode = 'controller';
let session: Session | null = null;
let paused = false;
let pauseReason = '';
let recovering = false;
let offlineStatus = 'Preparing offline support';
let applyUpdate: (() => void) | undefined;
let notice = '';
let devices: Device[] = [];
let deviceError = '';
let bindings: [Binding | null, Binding | null][] = emptyBindings();
let tested: Pair[] = emptyPairs();
let pendingTests: Pair[] = emptyPairs();
let crewReady = [false, false, false, false];
let pulses: Pair[] = emptyPairs();
let flashes = ['', '', '', ''];
let calibration: Calibration | null = null;
let calibrationTarget: [number, Side] | null = null;
let filter = new InputFilter(settings.players.map(player => player.cooldown));
let random = seededRandom(Date.now());
const keys = new Set<string>();
const transition = new TransitionTimer();
let lastDiagnostic = '';
let readyRound = 0;
let lastFrame = 0;
const connectionHistory = new ConnectionHistory();

function emptyPairs(): Pair[] { return Array.from({ length: 4 }, () => [false, false]); }
function emptyBindings(): [Binding | null, Binding | null][] { return Array.from({ length: 4 }, () => [null, null]); }
function presets(): Preset[] { return settings.players.slice(0, settings.count).map(player => player.preset); }
function resetInput(): void { filter.reset(); pulses = emptyPairs(); }
function stopLearning(): void { calibration = null; calibrationTarget = null; }
const bindingsComplete = (): boolean => bindings.slice(0, settings.count).every(pair => pair.every(Boolean));
const bindingsLive = (): boolean => bindings.slice(0, settings.count).every(pair => pair.every(binding => !!binding && devices.some(device => device.index === binding.device && device.id === binding.id)));
const crewChecked = (): boolean => tested.slice(0, settings.count).every(pair => pair.every(Boolean));
// Fires once per round, the first time every station has an outcome.
function noteReady(): void {
  if (session && !session.finished && ready(session) && readyRound !== session.round) { readyRound = session.round; boostRun.ready(); events.emit('roundReady', { round: session.round }); }
}
function announce(message: string): void { announcer.textContent = message; }
// What every switch is doing right now: keyboard keys or the learned controller buttons.
function readRaw(): Pair[] {
  return settings.players.map((player, i) => [0, 1].map(side => mode === 'controller' ? down(bindings[i][side], devices) : keys.has(player.keys[side])) as Pair);
}
function missionAnnouncement(): string {
  if (!session) return '';
  if (!settings.enlarged) return `Round ${session.round} of 6. New questions for ${settings.count === 1 ? 'the player' : `all ${settings.count} players`}.`;
  const player = session.active;
  const question = session.turns[player].question;
  const prompt = question.kind === 'count' ? 'How many objects?' : `${question.groups.join(' plus ')} equals what?`;
  return `Player ${player + 1}. ${prompt} Left answer ${question.choices[0]}. Right answer ${question.choices[1]}.`;
}
function setupState(): SetupState { return { offline: offlineStatus, canUpdate: Boolean(applyUpdate), notice }; }
function switchState(): SwitchState {
  const complete = bindingsComplete();
  return {
    players: settings.count, bindings, learning: calibrationTarget, complete, recovering,
    message: calibration ? calibration.message : complete ? 'All switches are matched. Next, the crew checks them together.' : 'Choose a switch below, then press and release the one you want for it.',
  };
}
function checkInState(): CheckInState {
  const pupils = settings.players.slice(0, settings.count);
  return {
    players: settings.count, mode, recovering,
    keys: pupils.map(player => player.keys),
    checked: tested.slice(0, settings.count),
    touched: pupils.map((_, i) => [tested[i][0] || pendingTests[i][0], tested[i][1] || pendingTests[i][1]] as Pair),
  };
}
function playState(): PlayState {
  const current = session!;
  const shown = settings.enlarged ? [current.active] : Array.from({ length: settings.count }, (_, i) => i);
  const resolved = settings.enlarged ? current.turns[current.active].outcome !== 'waiting' : ready(current);
  return {
    players: shown.length, round: current.round, completed: current.history.length, stars: current.stars, ready: ready(current),
    stations: shown.map(player => { const turn = current.turns[player]; return { player, question: turn.question, outcome: turn.outcome, attempts: turn.attempts, supported: turn.supported, picture: settings.players[player].quantities, paused }; }),
    next: !resolved || boostRun.flow === 'running' ? null : boostRun.flow === 'waiting' ? 'Boost round!' : settings.enlarged && current.active < settings.count - 1 ? 'Next player' : current.round === 6 ? 'Finish journey' : 'Next round',
    destination: Math.max(destinationOf(current.round), boostRun.arrival ?? 0) as 0 | 1 | 2, perfect: current.turns.every(turn => turn.outcome === 'correct'),
    turn: settings.enlarged ? `Player ${current.active + 1} of ${settings.count}` : '',
    pause: { paused, reason: pauseReason, recovering, quiet: settings.quiet, volume: settings.effectsVolume, music: settings.musicVolume, voice: settings.voiceVolume, narration: settings.narration, boost: boostRun.flow === 'running' },
  };
}
function finaleState(): FinaleState {
  const current = session!;
  return {
    players: settings.count, stars: current.stars, offline: offlineStatus, canUpdate: Boolean(applyUpdate),
    rows: presets().map((_, i) => {
      const turns = current.history.map(round => round[i]);
      return {
        player: i + 1, correct: turns.filter(turn => turn.outcome === 'correct').length,
        tries: turns.reduce((total, turn) => total + turn.attempts - (turn.outcome === 'correct' ? 1 : 0), 0),
        help: turns.filter(turn => turn.supported).length, passed: turns.filter(turn => turn.outcome === 'passed').length,
      };
    }),
  };
}
function render(): void {
  switch (router.current()) {
    case 'play': play.update(playState()); return;
    case 'finale': if (session) finale.update(finaleState()); return;
    case 'setup': setupScreen.update(setupState()); return;
    case 'switches': switches.update(switchState()); return;
    case 'checkin': checkin.update(checkInState()); return;
  }
}
function updateDiagnostics(): void {
  const current = deviceError || (devices.length ? devices.map(describeDevice).join('\n\n') : 'No controller visible yet. Pair the XAC in your computer’s Bluetooth settings or connect USB, then focus this page and press/release a switch.');
  switches.diagnostics(`${current}\n\nConnection history (this page, newest first):\n${connectionHistory.entries.join('\n') || 'No controller detected yet.'}`);
}
function pause(reason = ''): void {
  if (screen !== 'play' || paused) return;
  paused = true; transition.suspend(); pauseReason = reason; resetInput(); boostRun.pause(performance.now()); events.emit('gamePaused'); render();
}
function enter(next: View): void {
  screen = next;
  if (next === 'controls') lastDiagnostic = '';
  if (router.current() === routes[next]) render(); else router.go(routes[next]);
}
function prepareCheckin(): void {
  paused = false; tested = emptyPairs(); pendingTests = emptyPairs(); crewReady = [false, false, false, false]; flashes = ['', '', '', '']; stopLearning(); resetInput(); enter('checkin');
}
function endSession(): void {
  session = null; recovering = false; paused = false; transition.reset(); boostRun.reset();
  filter = new InputFilter(settings.players.map(player => player.cooldown));
}
function launch(): void {
  const fresh = !recovering;
  if (fresh) { random = seededRandom(Date.now()); session = createSession(presets(), random); readyRound = 0; boostRun.reset(); }
  paused = false; recovering = false; pauseReason = ''; flashes = ['', '', '', '']; resetInput(); enter('play');
  if (fresh) { events.emit('crewStart'); events.emit('roundStart', { round: 1 }); }
  announce(missionAnnouncement());
}
function perform(action: string): void {
  switch (action) {
    case 'prepare':
      notice = saveSettings(settings) ? '' : 'Preferences cannot be saved in this browser; this session will still work.';
      endSession(); bindings = emptyBindings(); stopLearning();
      if (mode === 'controller') enter('controls'); else prepareCheckin();
      return;
    case 'setup': endSession(); bindings = emptyBindings(); stopLearning(); resetInput(); enter('setup'); return;
    case 'controls': stopLearning(); enter('controls'); return;
    case 'clear-bindings': bindings = emptyBindings(); stopLearning(); render(); return;
    case 'checkin': if (mode === 'controller' && !bindingsComplete()) return; prepareCheckin(); return;
    case 'start': if (crewChecked()) launch(); return;
    // Starting with pilots still asleep is always an explicit teacher choice, and never offered while recovering a paused game.
    case 'start-anyway': if (!recovering) launch(); return;
    case 'pause': pause(); return;
    case 'resume':
      paused = false; pauseReason = ''; resetInput(); boostRun.resume(performance.now(), readRaw()); events.emit('gameResumed'); render();
      (app.querySelector<HTMLElement>('.sp-boost-pause') ?? app.querySelector<HTMLElement>('[data-action="pause"]'))?.focus();
      announce(missionAnnouncement());
      return;
    case 'pause-back': paused = true; enter('play'); events.emit('gamePaused'); return;
    case 'reconnect': bindings = emptyBindings(); stopLearning(); boostRun.interrupt(); enter('controls'); return;
    case 'skip-boost':
      if (boostRun.flow !== 'running') return;
      paused = false; pauseReason = ''; events.emit('gameResumed'); boostRun.skip(); resetInput(); render(); return;
    case 'next':
      if (session && !paused) {
        if (boostRun.flow === 'waiting') { boostRun.start(readRaw(), performance.now()); render(); return; }
        if (boostRun.flow === 'running') { if (boostRun.phase === 'finale') { boostRun.skip(); resetInput(); render(); } return; }
        const from = session.round;
        const reached = boostRun.arrival;
        if (!advance(session, presets(), random, settings.enlarged)) return;
        transition.reset(); flashes = ['', '', '', '']; resetInput();
        if (session.finished) { enter('results'); events.emit('missionComplete', { stars: session.stars }); }
        else {
          if (session.round !== from) {
            boostRun.newRound();
            events.emit('roundStart', { round: session.round });
            if (destinationOf(session.round) !== destinationOf(from) && reached !== destinationOf(session.round)) events.emit('destinationReached', { destination: destinationOf(session.round) });
          }
          render();
        }
        announce(session.finished ? `Mission complete. ${session.stars} crew stars collected.` : missionAnnouncement());
      } return;
    // Another adventure keeps the setup and the learned switches; check-in proves they still work. Switches that have gone send the teacher back to switch setup.
    case 'replay':
      endSession();
      if (mode === 'controller' && !bindingsLive()) { bindings = emptyBindings(); stopLearning(); enter('controls'); } else prepareCheckin();
      return;
    case 'finish': if (window.confirm('End this journey? Current crew stars will be cleared.')) perform('setup'); return;
    case 'sound': settings.quiet = !settings.quiet; saveSettings(settings); audio.refresh(); render(); return;
    case 'update': applyUpdate?.(); return;
  }
}
app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('button, a[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  if (button.dataset.action) { event.preventDefault(); if (button.dataset.action !== 'pause' && button.dataset.action !== 'resume') events.emit('uiClick'); perform(button.dataset.action); return; }
  if (button.dataset.mapPlayer !== undefined) {
    calibrationTarget = [Number(button.dataset.mapPlayer), Number(button.dataset.mapSide) as Side];
    bindings[calibrationTarget[0]][calibrationTarget[1]] = null; calibration = new Calibration(); render(); return;
  }
  if (button.dataset.answerPlayer !== undefined) { pulses[Number(button.dataset.answerPlayer)][Number(button.dataset.answerSide)] = true; return; }
  if (session && !paused && button.dataset.say !== undefined) events.emit('sayQuestion', { player: Number(button.dataset.say), question: session.turns[Number(button.dataset.say)].question });
  if (session && !paused && button.dataset.help !== undefined) {
    const player = Number(button.dataset.help), turn = session.turns[player];
    const first = turn.outcome === 'waiting' && !turn.supported;
    turn.supported = true;
    if (first) events.emit('turnHelped', { player, count: turn.question.groups.reduce((a, b) => a + b, 0), narrated: audio.narrating() });
    render(); announce(`Player ${player + 1}. Count together for help.`);
  }
  if (session && !paused && button.dataset.pass !== undefined) {
    const player = Number(button.dataset.pass), waiting = session.turns[player].outcome === 'waiting';
    pass(session, player);
    if (waiting) { events.emit('turnPassed', { player }); noteReady(); }
    render(); announce(`Player ${player + 1}. Travelling with the crew.`);
  }
});
// Sound settings are shared by teacher setup and the pause overlay, so they are handled here; every other setup control is handled by the setup screen.
app.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'effects-volume') { settings.effectsVolume = Number(target.value); saveSettings(settings); audio.refresh(); audio.preview('effects'); }
  if (target.id === 'music-volume') { settings.musicVolume = Number(target.value); saveSettings(settings); audio.refresh(); }
  if (target.id === 'voice-volume') { settings.voiceVolume = Number(target.value); saveSettings(settings); audio.refresh(); audio.preview('voice'); }
  if (target.id === 'narration') { settings.narration = target.checked; saveSettings(settings); audio.refresh(); }
});
window.addEventListener('keydown', event => {
  if (paused && event.key === 'Tab') {
    const focusable = Array.from(app.querySelectorAll<HTMLElement>('.pause-dialog button:not([hidden]), .pause-dialog select, .pause-dialog input'));
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)!.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  }
  if (event.key === 'Escape' && screen === 'play') { pause(); return; }
  // While a boost is counting down or live, Enter and N do nothing, so a focused saucer button still activates on Enter and no key can skip the boost by accident.
  const boostBusy = boostRun.flow === 'running' && boostRun.phase !== 'finale';
  const plain = !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey;
  const pupilUsesN = mode === 'keyboard' && settings.players.slice(0, settings.count).some(player => player.keys.includes('KeyN'));
  if (screen === 'play' && !paused && !boostBusy && plain) {
    // Enter always means Next once it is offered, even with a button focused; N is free unless a pupil uses that key.
    const typing = event.target instanceof Element && !!event.target.closest('a, select, input, textarea, summary');
    const enter = event.key === 'Enter' && !typing && !!session && (boostRun.flow === 'running' || (settings.enlarged ? session.turns[session.active].outcome !== 'waiting' : ready(session)));
    const letter = event.code === 'KeyN' && !typing && !pupilUsesN;
    if (enter || letter) { event.preventDefault(); perform('next'); return; }
  }
  // Enter or N starts the mission once every pilot is ready; a focused control keeps its own Enter.
  if (screen === 'checkin' && plain && crewChecked()) {
    const control = event.target instanceof Element && !!event.target.closest('a, button, select, input, textarea, summary');
    if ((event.key === 'Enter' && !control) || (event.code === 'KeyN' && !control && !pupilUsesN)) { event.preventDefault(); perform('start'); return; }
  }
  if ((screen === 'play' || screen === 'checkin') && mode === 'keyboard' && !paused && !event.ctrlKey && !event.metaKey && !event.altKey && settings.players.slice(0, settings.count).some(player => player.keys.includes(event.code))) {
    event.preventDefault(); if (!event.repeat) keys.add(event.code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); resetInput(); pause('The page lost focus. Your questions and stars are unchanged.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); resetInput(); pause('The page was hidden. Your questions and stars are unchanged.'); } });
window.addEventListener('gamepaddisconnected', event => {
  if (mode === 'controller' && screen !== 'setup' && screen !== 'results' && bindings.flat().some(binding => binding?.device === event.gamepad.index)) loseController();
});
function loseController(): void {
  bindings = emptyBindings(); stopLearning(); tested = emptyPairs(); pendingTests = emptyPairs(); resetInput();
  if (session && !session.finished) {
    recovering = true; paused = false; screen = 'play';
    if (router.current() !== 'play') router.go('play');
    pause('The assigned controller disconnected. Reconnect it and check every switch before resuming.');
  } else enter('controls');
}
function frame(now: number): void {
  const snapshot = readDevices(); devices = snapshot.devices; deviceError = snapshot.error;
  connectionHistory.sample(devices, now);
  if (mode === 'controller' && screen !== 'setup' && screen !== 'results' && bindings.flat().some(binding => binding && !devices.some(device => device.index === binding.device && device.id === binding.id))) loseController();
  if (screen === 'controls' && router.current() === 'switches') {
    const diagnostic = JSON.stringify(snapshot);
    if (diagnostic !== lastDiagnostic) { lastDiagnostic = diagnostic; updateDiagnostics(); }
    if (calibration && calibrationTarget) {
      const assigned = bindings.flat().filter((binding): binding is Binding => !!binding);
      const binding = calibration.sample(devices, assigned, now);
      switches.status(calibration.message);
      if (binding) { bindings[calibrationTarget[0]][calibrationTarget[1]] = binding; stopLearning(); render(); }
    }
    switches.lights(bindings.slice(0, settings.count).map(pair => pair.map(binding => down(binding, devices)) as Pair));
  }
  const dt = Math.min(100, Math.max(0, now - lastFrame));
  lastFrame = now;
  const raw = readRaw();
  const states: Pair[] = raw.map((pair, i) => pair.map((active, side) => active || pulses[i][side]) as Pair);
  const boosting = boostRun.flow === 'running';
  const actions = boosting ? [] : filter.sample(states, now);
  pulses = emptyPairs();
  let changed = false;
  const announcements: string[] = [];
  if (screen === 'checkin' && !document.hidden && document.hasFocus()) {
    for (const { pupil, side } of actions) {
      if (pupil >= settings.count) continue;
      events.emit('switchChecked', { player: pupil, side });
      announcements.push(`Player ${pupil + 1}. ${side ? 'Right' : 'Left'} switch connected.`);
      if (mode === 'keyboard' || raw[pupil][side]) pendingTests[pupil][side] = true;
      changed = true;
    }
    pendingTests.forEach((pair, i) => pair.forEach((pending, side) => {
      if (pending && !states[i][0] && !states[i][1]) { tested[i][side] = true; pendingTests[i][side] = false; changed = true; }
    }));
    for (let i = 0; i < settings.count; i++) {
      if (crewReady[i] || !tested[i][0] || !tested[i][1]) continue;
      crewReady[i] = true;
      events.emit('crewReady', { player: i });
      announcements.push(`Player ${i + 1}. Ready!`);
    }
  } else if (screen === 'play' && !paused && session) {
    for (const { pupil, side } of actions) {
      if (pupil >= settings.count || (settings.enlarged && pupil !== session.active) || session.turns[pupil].outcome !== 'waiting') continue;
      play.press(pupil, side);
      if (answer(session, pupil, side)) { events.emit('answerCorrect', { player: pupil, side }); announcements.push(`Player ${pupil + 1}. Star sent. Thank you!`); }
      else { events.emit('answerTry', { player: pupil, side }); flashes[pupil] = 'Let’s count together. You can try again.'; announcements.push(`Player ${pupil + 1}. ${flashes[pupil]}`); }
      changed = true;
    }
  }
  noteReady();
  boostRun.frame(states, now, dt, screen === 'play' && !paused && !document.hidden);
  const completed = !!session && !session.finished && ready(session) && boostRun.flow !== 'waiting' && boostRun.flow !== 'running';
  if (transition.sample(now, settings.autoAdvance && completed, screen === 'play' && !paused && !document.hidden, settings.transitionSeconds * 1000)) perform('next');
  if (changed) { render(); if (announcements.length) announce(announcements.join(' ')); }
  requestAnimationFrame(frame);
}
const router = createRouter<'title' | 'setup' | 'switches' | 'checkin' | 'play' | 'finale'>(app, name => events.emit('screen', { name }));
const play = createPlayScreen(playState, { quality: settings.quality, onBoostTap: player => { if (pulses[player]) pulses[player][0] = true; } });
const boostRun = createBoostRun({
  settings, view: play.boost, calm: isCalm, announce, round: () => session?.round ?? 1, stars: () => session?.stars ?? 0,
  arrived: destination => { events.emit('destinationReached', { destination }); render(); },
  ended() { resetInput(); if (session && session.round === 6 && !session.finished) perform('next'); else render(); },
});
const finale = createFinaleScreen(finaleState, { quality: settings.quality });
const setupScreen = createSetupScreen(setupState, { settings, mode: () => mode, setMode: next => { mode = next; }, refreshAudio: () => audio.refresh() });
const switches = createSwitchScreen(switchState);
const checkin = createCheckInScreen(checkInState);
router.register('title', createTitleScreen({ quality: settings.quality, onSetup: () => enter('setup') }));
router.register('setup', setupScreen);
router.register('switches', switches);
router.register('checkin', checkin);
router.register('play', play);
router.register('finale', finale);
router.go('title');
registerOffline((status, update) => {
  offlineStatus = status;
  applyUpdate = update;
  if (router.current() === 'setup' || router.current() === 'finale') render();
});
requestAnimationFrame(frame);
// Dev-server tests reach the running module instances here; the dev server can serve one module under two URLs, so importing them from the page is not reliable.
if (import.meta.env.DEV) Object.assign(window, { __nc: { events, motion, particles, pixi, arrive, boost: boostRun } });
