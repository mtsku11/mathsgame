import '@fontsource/titan-one/latin-400.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './style.css';
import './ui/theme.css';
import { loadSettings, saveSettings, type BoostPower, type BoostSettings } from './settings';
import { seededRandom, type Preset, type Side } from './game/questions';
import { createSession, answer, advance, pass, ready, type Session } from './game/session';
import { createBoostRun } from './app/boostRun';
import { InputFilter, type Pair } from './input/normalize';
import { Calibration, ConnectionHistory, describeDevice, readDevices, down, type Binding, type Device } from './input/gamepad';
import { marker, markers, rocket, planet } from './ui/art';
import { TransitionTimer } from './game/transition';
import { createAudio } from './audio/audio';
import { registerOffline } from './offline/register';
import { events } from './app/events';
import { createRouter, type Screen } from './app/router';
import { createTitleScreen } from './ui/screens/title';
import { destinationOf } from './ui/art/planets';
import { createFinaleScreen, type FinaleState } from './ui/screens/finale';
import { createPlayScreen, type PlayState } from './ui/screens/play';
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
const audio = createAudio(settings);
let legacyActive = false;
type View = 'setup' | 'controls' | 'practice' | 'play' | 'results';
let screen: View = 'setup';
let mode: 'controller' | 'keyboard' = 'controller';
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
const escape = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const players = (count: number): string => `${count} player${count === 1 ? '' : 's'}`;
const checked = (value: boolean): string => value ? 'checked' : '';
const selected = (value: boolean): string => value ? 'selected' : '';
function resetInput(): void { filter.reset(); pulses = emptyPairs(); }
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
function volumeControl(): string {
  const select = (id: string, label: string, value: number, describe = ''): string =>
    `<label>${label} volume<select id="${id}-volume"${describe}>${[0, 25, 50, 75, 100].map(level => `<option value="${level}" ${selected(value === level)}>${level === 0 ? 'Off' : `${level}%`}</option>`).join('')}</select></label>`;
  return `<div class="form-row">${select('effects', 'Effects', settings.effectsVolume, ' aria-describedby="volume-note"')}${select('music', 'Music', settings.musicVolume)}${select('voice', 'Voice', settings.voiceVolume)}</div><div class="checks"><label><input id="narration" type="checkbox" ${checked(settings.narration)}> Voice narration</label></div><p id="volume-note" class="muted">Quiet mode mutes all sound at every volume.</p>`;
}
function boostSettings(): string {
  const { boost } = settings;
  return `<fieldset class="boost-settings"><legend>Boost rounds</legend><p class="muted">After each maths round the crew presses their switches as fast as they can to power something amazing. It cannot be failed, and the maths itself stays untimed.</p>
  <div class="form-row"><label><input id="boost-enabled" type="checkbox" ${checked(boost.enabled)}> Boost round after every maths round</label><label><input id="boost-auto" type="checkbox" ${checked(boost.autoStart)}> Start each boost round automatically</label></div>
  <div class="form-row"><label>Boost length<select id="boost-seconds">${[8, 12, 16, 20].map(n => `<option value="${n}" ${selected(boost.seconds === n)}>${n} seconds</option>`).join('')}</select></label><label>Boost difficulty<select id="boost-difficulty">${(['easy', 'normal', 'hard'] as const).map(level => `<option value="${level}" ${selected(boost.difficulty === level)}>${level[0].toUpperCase()}${level.slice(1)}</option>`).join('')}</select></label></div>
  <div class="crew-settings">${settings.players.slice(0, settings.count).map((player, i) => `<div class="crew-row station-${i}"><span class="station-badge">${marker(i)}</span><label for="power-${i}">Player ${i + 1} boost power<small>Each press counts for more</small></label><select id="power-${i}" data-boost-power="${i}">${([1, 2, 3] as const).map(n => `<option value="${n}" ${selected(player.boostPower === n)}>×${n}</option>`).join('')}</select></div>`).join('')}</div></fieldset>`;
}
function header(): string {
  return `<header class="topbar"><a href="#" data-action="home" class="brand" aria-label="Number Crew home"><span class="brand-icon">${marker(3)}</span><span>NUMBER <strong>CREW</strong></span></a><div class="top-meta"><span class="status-dot"></span><span id="offline-status">${offlineStatus}</span><span class="tag">CLASSROOM EDITION</span></div></header>`;
}
function setup(): string {
  return `<main class="setup"><section class="intro"><p class="eyebrow">SMALL SUMS. SHARED ADVENTURES.</p><h1>A little maths.<br>A big <em>mission.</em></h1><p class="intro-copy">Count, choose, and explore together.<br>Every crew member has a part to play.</p><div class="hero-art">${planet(0)}${planet(1)}${rocket()}<span class="orbit"></span><span class="art-caption">THREE PLANETS · ONE CREW</span></div><div class="promise"><span>Two switches each</span><span>No time pressure</span><span>Everyone belongs</span></div></section>
  <section class="setup-card" aria-labelledby="setup-title"><p class="eyebrow">TEACHER SETUP</p><h2 id="setup-title">Assemble your crew</h2><p class="muted">Choose what works for your classroom.</p>
  <div class="form-row"><label>Crew size<select id="crew-count">${[1, 2, 3, 4].map(n => `<option value="${n}" ${selected(settings.count === n)}>${players(n)}</option>`).join('')}</select></label><label>Screen layout<select id="layout"><option value="together" ${selected(!settings.enlarged)}>Play together</option><option value="enlarged" ${selected(settings.enlarged)}>Enlarged turns</option></select></label></div>
  <div class="crew-settings">${settings.players.slice(0, settings.count).map((player, i) => `<div class="crew-row station-${i}"><span class="station-badge">${marker(i)}</span><label for="preset-${i}">Player ${i + 1}<small>${markers[i]} station</small></label><select id="preset-${i}" data-preset="${i}" aria-label="Player ${i + 1} maths"><option value="count" ${selected(player.preset === 'count')}>Count 1–5</option><option value="add5" ${selected(player.preset === 'add5')}>Add within 5</option><option value="add10" ${selected(player.preset === 'add10')}>Add within 10</option></select></div>`).join('')}</div>
  <fieldset class="input-choice"><legend>How will the crew answer?</legend><label><input type="radio" name="input-mode" value="controller" ${checked(mode === 'controller')}> Xbox Adaptive Controller <small>One shared controller · 2 switches per player</small></label><label><input type="radio" name="input-mode" value="keyboard" ${checked(mode === 'keyboard')}> Keyboard &amp; on-screen buttons <small>Try the game without a controller</small></label></fieldset>
  <div class="form-row"><label><input id="auto-advance" type="checkbox" ${checked(settings.autoAdvance)}> Advance completed rounds automatically</label><label>Celebration delay<select id="transition-seconds">${Array.from({ length: 9 }, (_, i) => i + 2).map(n => `<option value="${n}" ${selected(settings.transitionSeconds === n)}>${n} seconds</option>`).join('')}</select></label></div>${boostSettings()}<details class="access-settings"><summary>Comfort &amp; access settings</summary><div class="checks"><label><input id="quiet" type="checkbox" ${checked(settings.quiet)}> Quiet mode</label><label><input id="reduced" type="checkbox" ${checked(settings.reduced)}> Reduce motion</label><label><input id="simple" type="checkbox" ${checked(settings.simple)}> Less decoration</label></div>${volumeControl()}${settings.players.slice(0, settings.count).map((player, i) => `<fieldset><legend>Player ${i + 1}</legend><label><input type="checkbox" data-quantity="${i}" ${checked(player.quantities)}> Picture answers for addition</label><label>Input cooldown<select data-cooldown="${i}">${[0, 250, 500, 750, 1000, 1500].map(n => `<option value="${n}" ${selected(player.cooldown === n)}>${n} ms</option>`).join('')}</select></label><div class="form-row">${player.keys.map((key, side) => `<label>${side ? 'Right' : 'Left'} keyboard key<select aria-label="Player ${i + 1} ${side ? 'right' : 'left'} key" data-key-player="${i}" data-key-side="${side}">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `<option value="Key${letter}" ${selected(key === `Key${letter}`)}>${letter}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`).join('')}</details>
  <p class="notice" role="status">${escape(notice)}</p><button class="primary full" data-action="prepare">${mode === 'controller' ? 'Set up the switches' : 'Enter practice'} <span aria-hidden="true">→</span></button><p class="footnote">Teacher-led · 6 rounds · No names or accounts</p></section></main>`;
}
function controls(): string {
  const complete = bindings.slice(0, settings.count).every(pair => pair.every(Boolean));
  return `<main class="page narrow"><button class="text-button" data-action="${recovering ? 'pause-back' : 'setup'}">← ${recovering ? 'Back to paused game' : 'Teacher setup'}</button><p class="eyebrow">CONNECT · MAP · CHECK</p><h1>Two switches. Their own choices.</h1><p>Pair the shared XAC in your computer’s Bluetooth settings or connect it by USB. Keep this page focused, then press and release a switch to let the browser find it. Map one switch at a time.</p><div class="hardware-note">The controller is shared by ${settings.count === 1 ? 'the player' : `all ${settings.count} players`}. Use ${settings.count * 2} distinct switches. Classroom hardware compatibility is still to be tested.</div>
  <div class="mapping-grid">${bindings.slice(0, settings.count).map((pair, i) => `<section class="mapping-card station-${i}"><h2>${marker(i)} Player ${i + 1}</h2>${pair.map((binding, side) => `<button class="map-button ${calibrationTarget?.[0] === i && calibrationTarget[1] === side ? 'learning' : ''}" data-map-player="${i}" data-map-side="${side}"><span>${side ? 'Right' : 'Left'} answer</span><strong>${binding ? `Button ${binding.button} · checked` : 'Learn switch'}</strong></button>`).join('')}</section>`).join('')}</div>
  <p id="calibration-status" class="calibration-status" role="status">${calibration ? escape(calibration.message) : complete ? 'All switches mapped. Check them together in practice.' : 'Select “Learn switch” for the first player’s left answer.'}</p><details open class="diagnostics"><summary>Live controller diagnostics</summary><pre id="diagnostic-text"></pre></details><div class="button-row"><button data-action="clear-bindings">Clear mappings</button><button class="primary" data-action="practice" ${complete ? '' : 'disabled'}>Check switches in practice →</button></div></main>`;
}
function journey(): string {
  const current = Math.floor(((session?.round ?? 1) - 1) / 2);
  const completedRounds = session?.history.length ?? 0;
  return `<section class="journey" aria-label="Journey progress"><div class="journey-title"><p class="eyebrow">GETTING READY</p><h1>Try your two switches</h1><p>Press each one. Watch its card light up.</p></div><div class="route" style="--journey-offset:${Math.min(completedRounds, 5) * 43}px" aria-hidden="true">${[0, 1, 2].map(i => { const visited = completedRounds >= (i + 1) * 2; return `<div class="route-stop ${i === current ? 'current' : ''} ${visited ? 'visited' : ''}">${planet(i, visited)}<span>${visited ? 'DISCOVERED' : i + 1}</span></div>`; }).join('')}${rocket()}</div><div class="star-total"><span aria-hidden="true">✦</span><strong>${session?.stars ?? 0}</strong><small>crew stars</small></div></section>`;
}
function station(i: number): string {
  return `<section class="station station-${i}" aria-labelledby="station-${i}-title"><div class="station-heading"><h2 id="station-${i}-title">${marker(i)} Player ${i + 1}<span>${markers[i]}</span></h2><span class="station-state">PRACTICE</span></div>
  <div class="question-area"><p class="prompt">Make a connection</p><p class="practice-symbol" aria-hidden="true">${marker(i)}</p></div>
  <div class="answers">${[0, 1].map(side => `<button class="answer ${tested[i][side] ? 'tested' : ''}" data-answer-player="${i}" data-answer-side="${side}" aria-label="Player ${i + 1}, ${side ? 'right' : 'left'} answer"><span class="answer-value">${side ? 'Right' : 'Left'}</span><span class="answer-label">${side ? 'RIGHT' : 'LEFT'} <span>${mode === 'keyboard' ? settings.players[i].keys[side].slice(3) : 'SWITCH'}${tested[i][side] ? ' · CHECKED' : ''}</span></span></button>`).join('')}</div>
  <div class="station-footer"><p>${flashes[i] || 'Your left switch. Your right switch.'}</p></div></section>`;
}
function practiceScreen(): string {
  const practiceReady = mode === 'keyboard' || tested.slice(0, settings.count).every(pair => pair.every(Boolean));
  return `<main class="play-page">${journey()}<div class="stations ${settings.count === 1 ? 'solo' : ''}">${Array.from({ length: settings.count }, (_, i) => station(i)).join('')}${settings.count === 3 ? `<div class="empty-station">${rocket()}<p>Every answer is a little adventure.</p></div>` : ''}</div>
  <footer class="teacher-bar"><span class="eyebrow">TEACHER CONTROLS</span><div class="button-row"><button data-action="${mode === 'controller' ? 'controls' : 'setup'}">${mode === 'controller' ? 'Switch setup' : 'Back to setup'}</button><span class="practice-progress">${mode === 'controller' ? `${tested.slice(0, settings.count).flat().filter(Boolean).length} / ${settings.count * 2} switches checked` : 'Keyboard and on-screen buttons enabled'}</span><button class="primary" data-action="start" ${practiceReady ? '' : 'disabled'}>${recovering ? 'Resume journey' : 'Launch the journey'} →</button></div></footer></main>`;
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
      return { player: i + 1, first: turns.filter(t => t.outcome === 'correct' && t.attempts === 1 && !t.supported).length, retry: turns.filter(t => t.outcome === 'correct' && t.attempts > 1 && !t.supported).length,
        supported: turns.filter(t => t.outcome === 'correct' && t.supported).length, passed: turns.filter(t => t.outcome === 'passed').length };
    }),
  };
}
function render(): void {
  if (screen === 'play') { if (router.current() === 'play') play.update(playState()); return; }
  if (screen === 'results') { if (router.current() === 'finale' && session) finale.update(finaleState()); return; }
  if (!legacyActive) return;
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusData = focused?.dataset;
  document.body.classList.toggle('reduce-motion', settings.reduced);
  document.body.classList.toggle('simple', settings.simple);
  app.innerHTML = header() + (screen === 'setup' ? setup() : screen === 'controls' ? controls() : practiceScreen()) +
    (applyUpdate && screen === 'setup' ? '<div class="update-bar"><button data-action="update">Update game now</button></div>' : '');
  if (focusId) document.getElementById(focusId)?.focus();
  else if (focusData?.action) app.querySelector<HTMLElement>(`[data-action="${focusData.action}"]`)?.focus();
  else if (focusData?.answerPlayer) app.querySelector<HTMLElement>(`[data-answer-player="${focusData.answerPlayer}"][data-answer-side="${focusData.answerSide}"]`)?.focus();
  if (screen === 'controls') updateDiagnostics();
}
function updateDiagnostics(): void {
  const current = deviceError || (devices.length ? devices.map(describeDevice).join('\n\n') : 'No controller visible yet. Pair the XAC in your computer’s Bluetooth settings or connect USB, then focus this page and press/release a switch.');
  const diagnostic = `${current}\n\nConnection history (this page, newest first):\n${connectionHistory.entries.join('\n') || 'No controller detected yet.'}`;
  const node = document.getElementById('diagnostic-text');
  if (node && node.textContent !== diagnostic) node.textContent = diagnostic;
}
function pause(reason = ''): void {
  if (screen !== 'play' || paused) return;
  paused = true; transition.suspend(); pauseReason = reason; resetInput(); boostRun.pause(performance.now()); events.emit('gamePaused'); render();
}
function enter(next: View): void {
  screen = next;
  const target = next === 'play' ? 'play' : next === 'results' ? 'finale' : 'legacy';
  if (router.current() === target) render(); else router.go(target);
}
function preparePractice(): void {
  paused = false; tested = emptyPairs(); pendingTests = emptyPairs(); flashes = ['', '', '', '']; calibration = null; resetInput(); enter('practice');
}
function newJourneySetup(): void {
  session = null; recovering = false; paused = false; bindings = emptyBindings(); transition.reset(); boostRun.reset();
  filter = new InputFilter(settings.players.map(player => player.cooldown));
  if (mode === 'controller') enter('controls'); else preparePractice();
}
function perform(action: string): void {
  switch (action) {
    case 'home': if (screen === 'play') pause(); else if (!recovering) { session = null; enter('setup'); } return;
    case 'prepare': notice = saveSettings(settings) ? '' : 'Preferences cannot be saved in this browser; this session will still work.'; newJourneySetup(); return;
    case 'setup': session = null; paused = false; recovering = false; calibration = null; boostRun.reset(); resetInput(); enter('setup'); return;
    case 'controls': calibration = null; enter('controls'); return;
    case 'clear-bindings': bindings = emptyBindings(); calibration = null; calibrationTarget = null; render(); return;
    case 'practice': preparePractice(); return;
    case 'start':
      if (mode === 'controller' && !tested.slice(0, settings.count).every(pair => pair.every(Boolean))) return;
      const fresh = !recovering;
      if (fresh) { random = seededRandom(Date.now()); session = createSession(presets(), random); readyRound = 0; boostRun.reset(); }
      paused = false; recovering = false; pauseReason = ''; flashes = ['', '', '', '']; resetInput(); enter('play');
      if (fresh) events.emit('roundStart', { round: 1 });
      announce(missionAnnouncement()); return;
    case 'pause': pause(); return;
    case 'resume':
      paused = false; pauseReason = ''; resetInput(); boostRun.resume(performance.now(), readRaw()); events.emit('gameResumed'); render();
      (app.querySelector<HTMLElement>('.sp-boost-pause') ?? app.querySelector<HTMLElement>('[data-action="pause"]'))?.focus();
      announce(missionAnnouncement());
      return;
    case 'pause-back': paused = true; enter('play'); events.emit('gamePaused'); return;
    case 'reconnect': bindings = emptyBindings(); calibration = null; boostRun.interrupt(); enter('controls'); return;
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
    case 'replay': newJourneySetup(); return;
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
app.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'crew-count') { settings.count = Number(target.value); render(); }
  if (target.id === 'auto-advance') settings.autoAdvance = target.checked;
  if (target.id === 'transition-seconds') settings.transitionSeconds = Number(target.value);
  if (target.id === 'layout') settings.enlarged = target.value === 'enlarged';
  if (target.id === 'boost-enabled') settings.boost.enabled = target.checked;
  if (target.id === 'boost-auto') settings.boost.autoStart = target.checked;
  if (target.id === 'boost-seconds') settings.boost.seconds = Number(target.value) as BoostSettings['seconds'];
  if (target.id === 'boost-difficulty') settings.boost.difficulty = target.value as BoostSettings['difficulty'];
  if (target.dataset.boostPower !== undefined) settings.players[Number(target.dataset.boostPower)].boostPower = Number(target.value) as BoostPower;
  if (target.name === 'input-mode') { mode = target.value as typeof mode; render(); }
  if (target.dataset.preset !== undefined) settings.players[Number(target.dataset.preset)].preset = target.value as Preset;
  if (target.dataset.quantity !== undefined) settings.players[Number(target.dataset.quantity)].quantities = target.checked;
  if (target.dataset.cooldown !== undefined) settings.players[Number(target.dataset.cooldown)].cooldown = Number(target.value);
  if (target.dataset.keyPlayer !== undefined) {
    const player = Number(target.dataset.keyPlayer), side = Number(target.dataset.keySide) as Side;
    if (settings.players.some((p, i) => p.keys.some((key, s) => key === target.value && (i !== player || s !== side)))) {
      notice = 'That key is already assigned. Choose a different letter.';
      target.value = settings.players[player].keys[side];
      app.querySelector('.notice')!.textContent = notice;
    } else { settings.players[player].keys[side] = target.value; notice = ''; app.querySelector('.notice')!.textContent = ''; }
  }
  if (target.id === 'effects-volume') { settings.effectsVolume = Number(target.value); saveSettings(settings); audio.refresh(); audio.preview('effects'); }
  if (target.id === 'music-volume') { settings.musicVolume = Number(target.value); saveSettings(settings); audio.refresh(); }
  if (target.id === 'voice-volume') { settings.voiceVolume = Number(target.value); saveSettings(settings); audio.refresh(); audio.preview('voice'); }
  if (target.id === 'narration') { settings.narration = target.checked; saveSettings(settings); audio.refresh(); }
  if (target.id === 'quiet') { settings.quiet = target.checked; audio.refresh(); }
  if (target.id === 'reduced') { settings.reduced = target.checked; setReducedMotion(target.checked); }
  if (target.id === 'simple') settings.simple = target.checked;
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
  if (screen === 'play' && !paused && !boostBusy && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
    // Enter always means Next once it is offered, even with a button focused; N is free unless a pupil uses that key.
    const typing = event.target instanceof Element && !!event.target.closest('a, select, input, textarea, summary');
    const enter = event.key === 'Enter' && !typing && !!session && (boostRun.flow === 'running' || (settings.enlarged ? session.turns[session.active].outcome !== 'waiting' : ready(session)));
    const letter = event.code === 'KeyN' && !typing && !(mode === 'keyboard' && settings.players.slice(0, settings.count).some(player => player.keys.includes('KeyN')));
    if (enter || letter) { event.preventDefault(); perform('next'); return; }
  }
  if ((screen === 'play' || screen === 'practice') && mode === 'keyboard' && !paused && !event.ctrlKey && !event.metaKey && !event.altKey && settings.players.slice(0, settings.count).some(player => player.keys.includes(event.code))) {
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
  bindings = emptyBindings(); calibration = null; tested = emptyPairs(); pendingTests = emptyPairs(); resetInput();
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
  if (screen === 'controls') {
    const diagnostic = JSON.stringify(snapshot);
    if (diagnostic !== lastDiagnostic) { lastDiagnostic = diagnostic; updateDiagnostics(); }
    if (calibration && calibrationTarget) {
      const assigned = bindings.flat().filter((binding): binding is Binding => !!binding);
      const binding = calibration.sample(devices, assigned, now);
      const status = document.getElementById('calibration-status');
      if (status && status.textContent !== calibration.message) status.textContent = calibration.message;
      if (binding) { bindings[calibrationTarget[0]][calibrationTarget[1]] = binding; calibration = null; calibrationTarget = null; render(); }
    }
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
  if (screen === 'practice' && !document.hidden && document.hasFocus()) {
    for (const { pupil, side } of actions) {
      if (pupil >= settings.count) continue;
      flashes[pupil] = `${side ? 'Right' : 'Left'} switch connected.`;
      events.emit('switchChecked', { player: pupil, side });
      announcements.push(`Player ${pupil + 1}. ${flashes[pupil]}`);
      if (mode === 'keyboard' || raw[pupil][side]) pendingTests[pupil][side] = true;
      changed = true;
    }
    pendingTests.forEach((pair, i) => pair.forEach((pending, side) => {
      if (pending && !states[i][0] && !states[i][1]) { tested[i][side] = true; pendingTests[i][side] = false; changed = true; }
    }));
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
const router = createRouter<'title' | 'legacy' | 'play' | 'finale'>(app, name => events.emit('screen', { name }));
const play = createPlayScreen(playState, { quality: settings.quality, onBoostTap: player => { if (pulses[player]) pulses[player][0] = true; } });
const boostRun = createBoostRun({
  settings, view: play.boost, calm: isCalm, announce, round: () => session?.round ?? 1, stars: () => session?.stars ?? 0,
  arrived: destination => { events.emit('destinationReached', { destination }); render(); },
  ended() { resetInput(); if (session && session.round === 6 && !session.finished) perform('next'); else render(); },
});
const finale = createFinaleScreen(finaleState, { quality: settings.quality });
const legacy: Screen = { mount() { legacyActive = true; render(); }, unmount() { legacyActive = false; } };
router.register('title', createTitleScreen({ quality: settings.quality, onSetup: () => router.go('legacy') }));
router.register('legacy', legacy);
router.register('play', play);
router.register('finale', finale);
router.go('title');
registerOffline((status, update) => {
  offlineStatus = status;
  applyUpdate = update;
  if (router.current() === 'finale' && session) finale.update(finaleState());
  if (!legacyActive) return;
  const label = document.getElementById('offline-status');
  if (label) label.textContent = status;
  const updateBar = app.querySelector('.update-bar');
  const showUpdate = Boolean(applyUpdate) && screen === 'setup';
  if (showUpdate && !updateBar) app.insertAdjacentHTML('beforeend', '<div class="update-bar"><button data-action="update">Update game now</button></div>');
  if (!showUpdate) updateBar?.remove();
});
requestAnimationFrame(frame);
// Dev-server tests reach the running module instances here; the dev server can serve one module under two URLs, so importing them from the page is not reliable.
if (import.meta.env.DEV) Object.assign(window, { __nc: { events, motion, particles, pixi, arrive, boost: boostRun } });
