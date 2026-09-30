import './style.css';
import { loadSettings, saveSettings } from './settings';
import { seededRandom, type Preset, type Side } from './game/questions';
import { createSession, answer, advance, pass, ready, type Session } from './game/session';
import { InputFilter, type Pair } from './input/normalize';
import { Calibration, ConnectionHistory, describeDevice, readDevices, down, type Binding, type Device } from './input/gamepad';
import { cargoPod, marker, markers, missionPart, rocket, dots, planet } from './ui/art';
import { TransitionTimer } from './game/transition';
import { registerOffline } from './offline/register';

const app = document.querySelector<HTMLDivElement>('#app')!;
const announcer = document.createElement('p');
announcer.id = 'game-status';
announcer.className = 'sr-only';
announcer.setAttribute('role', 'status');
announcer.setAttribute('aria-live', 'polite');
announcer.setAttribute('aria-atomic', 'true');
document.body.append(announcer);
const settings = loadSettings();
let screen: 'setup' | 'controls' | 'practice' | 'play' | 'results' = 'setup';
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
let audio: AudioContext | null = null;
let lastDiagnostic = '';
const connectionHistory = new ConnectionHistory();

function emptyPairs(): Pair[] { return Array.from({ length: 4 }, () => [false, false]); }
function emptyBindings(): [Binding | null, Binding | null][] { return Array.from({ length: 4 }, () => [null, null]); }
function presets(): Preset[] { return settings.players.slice(0, settings.count).map(player => player.preset); }
const escape = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const players = (count: number): string => `${count} player${count === 1 ? '' : 's'}`;
const checked = (value: boolean): string => value ? 'checked' : '';
const selected = (value: boolean): string => value ? 'selected' : '';
function resetInput(): void { filter.reset(); pulses = emptyPairs(); }
function announce(message: string): void { announcer.textContent = message; }
function missionAnnouncement(): string {
  if (!session) return '';
  if (!settings.enlarged) return `Round ${session.round} of 6. New questions for ${settings.count === 1 ? 'the player' : `all ${settings.count} players`}.`;
  const player = session.active;
  const question = session.turns[player].question;
  const prompt = question.kind === 'count' ? 'How many objects?' : `${question.groups.join(' plus ')} equals what?`;
  return `Player ${player + 1}. ${prompt} Left answer ${question.choices[0]}. Right answer ${question.choices[1]}.`;
}
function sound(): void {
  if (settings.quiet || settings.effectsVolume === 0 || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.setValueAtTime(523.25, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(783.99, audio.currentTime + 0.16);
  gain.gain.setValueAtTime(0.035 * settings.effectsVolume / 100, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001 * settings.effectsVolume / 100, audio.currentTime + 0.25);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + 0.26);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function animateCargo(player: number): void {
  if (settings.reduced || settings.simple || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const source = app.querySelector(`.station-${player} .station-heading`);
  const target = app.querySelector(`.cargo-bay .cargo-${player}`);
  if (!source || !target) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const shell = document.createElement('div');
  shell.innerHTML = cargoPod(player);
  const pod = shell.firstElementChild as SVGElement;
  pod.classList.add('cargo-flight');
  pod.style.left = `${from.left + from.width / 2 - 20}px`;
  pod.style.top = `${from.top + from.height / 2 - 14}px`;
  pod.style.setProperty('--cargo-x', `${to.left + to.width / 2 - from.left - from.width / 2}px`);
  pod.style.setProperty('--cargo-y', `${to.top + to.height / 2 - from.top - from.height / 2}px`);
  document.body.append(pod);
  pod.addEventListener('animationend', () => pod.remove(), { once: true });
}
function enableAudio(): void {
  if (!settings.quiet) { audio ??= new AudioContext(); void audio.resume().catch(() => { notice = 'Sound is unavailable. All feedback is also shown on screen.'; }); }
}
function volumeControl(): string {
  return `<label>Effects volume<select id="effects-volume" aria-describedby="volume-note">${[0, 25, 50, 75, 100].map(value => `<option value="${value}" ${selected(settings.effectsVolume === value)}>${value === 0 ? 'Off' : `${value}%`}</option>`).join('')}</select></label><p id="volume-note" class="muted">Quiet mode mutes effects at every volume.</p>`;
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
  <div class="form-row"><label><input id="auto-advance" type="checkbox" ${checked(settings.autoAdvance)}> Advance completed rounds automatically</label><label>Celebration delay<select id="transition-seconds">${Array.from({ length: 9 }, (_, i) => i + 2).map(n => `<option value="${n}" ${selected(settings.transitionSeconds === n)}>${n} seconds</option>`).join('')}</select></label></div><details class="access-settings"><summary>Comfort &amp; access settings</summary><div class="checks"><label><input id="quiet" type="checkbox" ${checked(settings.quiet)}> Quiet mode</label><label><input id="reduced" type="checkbox" ${checked(settings.reduced)}> Reduce motion</label><label><input id="simple" type="checkbox" ${checked(settings.simple)}> Less decoration</label></div>${volumeControl()}${settings.players.slice(0, settings.count).map((player, i) => `<fieldset><legend>Player ${i + 1}</legend><label><input type="checkbox" data-quantity="${i}" ${checked(player.quantities)}> Picture answers for addition</label><label>Input cooldown<select data-cooldown="${i}">${[0, 250, 500, 750, 1000, 1500].map(n => `<option value="${n}" ${selected(player.cooldown === n)}>${n} ms</option>`).join('')}</select></label><div class="form-row">${player.keys.map((key, side) => `<label>${side ? 'Right' : 'Left'} keyboard key<select aria-label="Player ${i + 1} ${side ? 'right' : 'left'} key" data-key-player="${i}" data-key-side="${side}">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `<option value="Key${letter}" ${selected(key === `Key${letter}`)}>${letter}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`).join('')}</details>
  <p class="notice" role="status">${escape(notice)}</p><button class="primary full" data-action="prepare">${mode === 'controller' ? 'Set up the switches' : 'Enter practice'} <span aria-hidden="true">→</span></button><p class="footnote">Teacher-led · 6 rounds · No names or accounts</p></section></main>`;
}
function controls(): string {
  const complete = bindings.slice(0, settings.count).every(pair => pair.every(Boolean));
  return `<main class="page narrow"><button class="text-button" data-action="${recovering ? 'pause-back' : 'setup'}">← ${recovering ? 'Back to paused game' : 'Teacher setup'}</button><p class="eyebrow">CONNECT · MAP · CHECK</p><h1>Two switches. Their own choices.</h1><p>Pair the shared XAC in your computer’s Bluetooth settings or connect it by USB. Keep this page focused, then press and release a switch to let the browser find it. Map one switch at a time.</p><div class="hardware-note">The controller is shared by ${settings.count === 1 ? 'the player' : `all ${settings.count} players`}. Use ${settings.count * 2} distinct switches. Classroom hardware compatibility is still to be tested.</div>
  <div class="mapping-grid">${bindings.slice(0, settings.count).map((pair, i) => `<section class="mapping-card station-${i}"><h2>${marker(i)} Player ${i + 1}</h2>${pair.map((binding, side) => `<button class="map-button ${calibrationTarget?.[0] === i && calibrationTarget[1] === side ? 'learning' : ''}" data-map-player="${i}" data-map-side="${side}"><span>${side ? 'Right' : 'Left'} answer</span><strong>${binding ? `Button ${binding.button} · checked` : 'Learn switch'}</strong></button>`).join('')}</section>`).join('')}</div>
  <p id="calibration-status" class="calibration-status" role="status">${calibration ? escape(calibration.message) : complete ? 'All switches mapped. Check them together in practice.' : 'Select “Learn switch” for the first player’s left answer.'}</p><details open class="diagnostics"><summary>Live controller diagnostics</summary><pre id="diagnostic-text"></pre></details><div class="button-row"><button data-action="clear-bindings">Clear mappings</button><button class="primary" data-action="practice" ${complete ? '' : 'disabled'}>Check switches in practice →</button></div></main>`;
}
function journey(): string {
  const round = session?.round ?? 1;
  const names = ['Amber Moon', 'Coral World', 'Quiet Blue'];
  const current = Math.floor((round - 1) / 2);
  const completedRounds = session?.history.length ?? 0;
  const cargo = session?.turns.map((turn, i) => turn.outcome === 'correct' ? cargoPod(i) : '').join('') ?? '';
  return `<section class="journey" aria-label="Journey progress"><div class="journey-title"><p class="eyebrow">${screen === 'practice' ? 'GETTING READY' : `DESTINATION ${current + 1} OF 3`}</p><h1>${screen === 'practice' ? 'Try your two switches' : names[current]}</h1><p>${screen === 'practice' ? 'Press each one. Watch its card light up.' : `Round ${round} of 6 · Take all the time you need`}</p></div><div class="route" style="--journey-offset:${Math.min(completedRounds, 5) * 43}px" aria-hidden="true">${names.map((_name, i) => { const visited = completedRounds >= (i + 1) * 2; return `<div class="route-stop ${i === current ? 'current' : ''} ${visited ? 'visited' : ''}">${planet(i, visited)}<span>${visited ? 'DISCOVERED' : i + 1}</span></div>`; }).join('')}${rocket()}<div class="cargo-bay">${cargo}</div><div class="mission-parts">${Array.from({ length: 6 }, (_, i) => missionPart(i, i < completedRounds)).join('')}</div></div><div class="star-total"><span aria-hidden="true">✦</span><strong>${session?.stars ?? 0}</strong><small>crew stars</small></div></section>`;
}
function station(i: number, practice: boolean): string {
  const turn = practice ? null : session!.turns[i];
  const q = turn?.question;
  const done = !!turn && turn.outcome !== 'waiting';
  const feedback = practice ? flashes[i] || 'Your left switch. Your right switch.' : turn?.outcome === 'correct' ? 'Cargo ready. Thank you!' : turn?.outcome === 'passed' ? 'Travelling with the crew.' : flashes[i] || 'Choose your answer';
  return `<section class="station station-${i} ${done ? 'resolved' : ''}" aria-labelledby="station-${i}-title"><div class="station-heading"><h2 id="station-${i}-title">${marker(i)} Player ${i + 1}<span>${markers[i]}</span></h2><span class="station-state">${done ? 'READY' : practice ? 'PRACTICE' : 'YOUR TURN'}</span></div>
  <div class="question-area">${practice ? `<p class="prompt">Make a connection</p><p class="practice-symbol" aria-hidden="true">${marker(i)}</p>` : `<p class="prompt">${q!.kind === 'count' ? 'How many?' : `${q!.groups.join(' + ')} = ?`}</p><div class="groups">${q!.groups.map(value => dots(value)).join('<span class="plus" aria-hidden="true">+</span>')}</div>`}</div>
  <div class="answers">${[0, 1].map(side => `<button class="answer ${practice && tested[i][side] ? 'tested' : ''}" data-answer-player="${i}" data-answer-side="${side}" ${done || paused ? 'disabled' : ''} aria-label="Player ${i + 1}, ${side ? 'right' : 'left'} answer${q ? `, ${q.choices[side]}` : ''}"><span class="answer-value">${practice ? side ? 'Right' : 'Left' : settings.players[i].quantities && q!.kind === 'add' ? dots(q!.choices[side]) : q!.choices[side]}</span><span class="answer-label">${side ? 'RIGHT' : 'LEFT'} <span>${mode === 'keyboard' ? settings.players[i].keys[side].slice(3) : 'SWITCH'}${practice && tested[i][side] ? ' · CHECKED' : ''}</span></span></button>`).join('')}</div>
  <div class="station-footer"><p>${feedback}</p>${!practice ? `<div class="teacher-small"><button aria-label="Help player ${i + 1}" data-help="${i}" ${done || paused ? 'disabled' : ''}>Help</button><button aria-label="Pass player ${i + 1}" data-pass="${i}" ${done || paused ? 'disabled' : ''}>Pass</button></div>` : ''}</div>${turn?.supported && !done ? `<div class="scaffold">Count together: ${Array.from({ length: q!.groups.reduce((a, b) => a + b, 0) }, (_, n) => `<span>${n + 1}</span>`).join('')}</div>` : '<div class="scaffold-space" aria-hidden="true"></div>'}</section>`;
}
function playScreen(): string {
  const practice = screen === 'practice';
  const shown = !practice && settings.enlarged ? [session!.active] : Array.from({ length: settings.count }, (_, i) => i);
  const practiceReady = mode === 'keyboard' || tested.slice(0, settings.count).every(pair => pair.every(Boolean));
  const nextReady = !practice && (settings.enlarged ? session!.turns[session!.active].outcome !== 'waiting' : ready(session!));
  return `<main class="play-page">${journey()}<div class="stations ${!practice && settings.enlarged ? 'enlarged' : shown.length === 1 ? 'solo' : ''}">${shown.map(i => station(i, practice)).join('')}${shown.length === 3 ? `<div class="empty-station">${rocket()}<p>Every answer is a little adventure.</p></div>` : ''}</div>
  <footer class="teacher-bar"><span class="eyebrow">TEACHER CONTROLS</span><div class="button-row">${practice ? `<button data-action="${mode === 'controller' ? 'controls' : 'setup'}">${mode === 'controller' ? 'Switch setup' : 'Back to setup'}</button><span class="practice-progress">${mode === 'controller' ? `${tested.slice(0, settings.count).flat().filter(Boolean).length} / ${settings.count * 2} switches checked` : 'Keyboard and on-screen buttons enabled'}</span><button class="primary" data-action="start" ${practiceReady ? '' : 'disabled'}>${recovering ? 'Resume journey' : 'Launch the journey'} →</button>` : `<button data-action="pause">Pause journey</button><span class="turn-note">${settings.enlarged ? `Player ${session!.active + 1} of ${settings.count}` : 'We travel together'}</span><button class="primary" data-action="next" ${nextReady ? '' : 'disabled'}>${settings.enlarged && session!.active < settings.count - 1 ? 'Next player' : session!.round === 6 ? 'Finish journey' : 'Next round'} →</button>`}</div></footer></main>${paused ? pauseOverlay() : ''}`;
}
function pauseOverlay(): string {
  return `<div class="modal-backdrop"><section class="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabindex="-1"><p class="eyebrow">TAKE A BREATHER</p><h1 id="pause-title">Journey paused</h1><p>${escape(pauseReason || 'Your crew’s progress is safe. Take all the time you need.')}</p><p class="muted">Release all switches before continuing.</p><div class="button-stack">${recovering ? '<button class="primary" data-action="reconnect">Reconnect &amp; check switches</button>' : '<button class="primary" data-action="resume">Resume journey</button>'}<button data-action="sound">${settings.quiet ? 'Enable gentle sound' : 'Turn sound off'}</button>${volumeControl()}<button data-action="finish">End journey &amp; return to setup</button></div></section></div>`;
}
function results(): string {
  return `<main class="results page"><p class="eyebrow">MISSION COMPLETE</p><h1>A whole crew.<br>A brilliant journey.</h1><div class="result-planets">${[0, 1, 2].map(i => planet(i, true)).join('')}${rocket()}</div><div class="mission-parts result-assembly">${Array.from({ length: 6 }, (_, i) => missionPart(i, true)).join('')}</div><p class="result-stars">✦ ${session!.stars} crew stars collected</p><p>You counted. You explored. You got there together.</p><div class="button-row"><button class="primary" data-action="replay">Another adventure →</button><button data-action="setup">Teacher setup</button></div><details class="summary"><summary>Teacher observation · this session only</summary><p>Two choices include a chance element. This is observation, not an attainment score.</p><table><thead><tr><th>Station</th><th>First try</th><th>Retry</th><th>Supported</th><th>Passed</th></tr></thead><tbody>${presets().map((_, i) => { const turns = session!.history.map(round => round[i]); return `<tr><th>Player ${i + 1}</th><td>${turns.filter(t => t.outcome === 'correct' && t.attempts === 1 && !t.supported).length}</td><td>${turns.filter(t => t.outcome === 'correct' && t.attempts > 1 && !t.supported).length}</td><td>${turns.filter(t => t.outcome === 'correct' && t.supported).length}</td><td>${turns.filter(t => t.outcome === 'passed').length}</td></tr>`; }).join('')}</tbody></table><p>Results disappear when you start again. No pupil data is saved.</p></details></main>`;
}
function render(): void {
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusData = focused?.dataset;
  document.body.classList.toggle('reduce-motion', settings.reduced);
  document.body.classList.toggle('simple', settings.simple);
  app.innerHTML = header() + (screen === 'setup' ? setup() : screen === 'controls' ? controls() : screen === 'results' ? results() : playScreen()) +
    (applyUpdate && (screen === 'setup' || screen === 'results') ? '<div class="update-bar"><button data-action="update">Update game now</button></div>' : '');
  if (paused && screen === 'play') {
    app.querySelector<HTMLElement>('main')!.inert = true;
    app.querySelector<HTMLElement>('header')!.inert = true;
    app.querySelector<HTMLElement>('.pause-dialog button, .pause-dialog select')?.focus();
  } else if (focusId) document.getElementById(focusId)?.focus();
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
  paused = true; transition.suspend(); pauseReason = reason; resetInput(); render();
}
function preparePractice(): void {
  screen = 'practice'; paused = false; tested = emptyPairs(); pendingTests = emptyPairs(); flashes = ['', '', '', '']; calibration = null; resetInput(); render();
}
function newJourneySetup(): void {
  session = null; recovering = false; paused = false; bindings = emptyBindings(); transition.reset();
  filter = new InputFilter(settings.players.map(player => player.cooldown));
  if (mode === 'controller') { screen = 'controls'; render(); } else preparePractice();
}
function perform(action: string): void {
  switch (action) {
    case 'home': if (screen === 'play') pause(); else if (!recovering) { screen = 'setup'; session = null; render(); } return;
    case 'prepare': notice = saveSettings(settings) ? '' : 'Preferences cannot be saved in this browser; this session will still work.'; enableAudio(); newJourneySetup(); return;
    case 'setup': session = null; paused = false; recovering = false; screen = 'setup'; calibration = null; resetInput(); render(); return;
    case 'controls': screen = 'controls'; calibration = null; render(); return;
    case 'clear-bindings': bindings = emptyBindings(); calibration = null; calibrationTarget = null; render(); return;
    case 'practice': preparePractice(); return;
    case 'start':
      if (mode === 'controller' && !tested.slice(0, settings.count).every(pair => pair.every(Boolean))) return;
      if (!recovering) { random = seededRandom(Date.now()); session = createSession(presets(), random); }
      screen = 'play'; paused = false; recovering = false; pauseReason = ''; flashes = ['', '', '', '']; resetInput(); render(); announce(missionAnnouncement()); return;
    case 'pause': pause(); return;
    case 'resume':
      paused = false; pauseReason = ''; resetInput(); render();
      app.querySelector<HTMLElement>('[data-action="pause"]')?.focus();
      announce(missionAnnouncement());
      return;
    case 'pause-back': screen = 'play'; paused = true; render(); return;
    case 'reconnect': bindings = emptyBindings(); calibration = null; screen = 'controls'; render(); return;
    case 'next':
      if (session && !paused && advance(session, presets(), random, settings.enlarged)) {
        transition.reset(); flashes = ['', '', '', '']; resetInput(); if (session.finished) { screen = 'results'; sound(); } render();
        announce(session.finished ? `Mission complete. ${session.stars} crew stars collected.` : missionAnnouncement());
      } return;
    case 'replay': newJourneySetup(); return;
    case 'finish': if (window.confirm('End this journey? Current crew stars will be cleared.')) perform('setup'); return;
    case 'sound': settings.quiet = !settings.quiet; enableAudio(); saveSettings(settings); render(); return;
    case 'update': applyUpdate?.(); return;
  }
}
app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('button, a[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  if (button.dataset.action) { event.preventDefault(); perform(button.dataset.action); return; }
  if (button.dataset.mapPlayer !== undefined) {
    calibrationTarget = [Number(button.dataset.mapPlayer), Number(button.dataset.mapSide) as Side];
    bindings[calibrationTarget[0]][calibrationTarget[1]] = null; calibration = new Calibration(); render(); return;
  }
  if (button.dataset.answerPlayer !== undefined) { pulses[Number(button.dataset.answerPlayer)][Number(button.dataset.answerSide)] = true; return; }
  if (session && !paused && button.dataset.help !== undefined) {
    const player = Number(button.dataset.help); session.turns[player].supported = true; render(); announce(`Player ${player + 1}. Count together for help.`);
  }
  if (session && !paused && button.dataset.pass !== undefined) { const player = Number(button.dataset.pass); pass(session, player); render(); announce(`Player ${player + 1}. Travelling with the crew.`); }
});
app.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'crew-count') { settings.count = Number(target.value); render(); }
  if (target.id === 'auto-advance') settings.autoAdvance = target.checked;
  if (target.id === 'transition-seconds') settings.transitionSeconds = Number(target.value);
  if (target.id === 'layout') settings.enlarged = target.value === 'enlarged';
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
  if (target.id === 'effects-volume') { settings.effectsVolume = Number(target.value); saveSettings(settings); }
  if (target.id === 'quiet') { settings.quiet = target.checked; enableAudio(); }
  if (target.id === 'reduced') settings.reduced = target.checked;
  if (target.id === 'simple') settings.simple = target.checked;
});
window.addEventListener('keydown', event => {
  if (paused && event.key === 'Tab') {
    const focusable = Array.from(app.querySelectorAll<HTMLElement>('.pause-dialog button, .pause-dialog select'));
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)!.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  }
  if (event.key === 'Escape' && screen === 'play') { pause(); return; }
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
  if (session && !session.finished) { recovering = true; screen = 'play'; paused = false; pause('The assigned controller disconnected. Reconnect it and check every switch before resuming.'); }
  else { screen = 'controls'; render(); }
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
  const raw: Pair[] = settings.players.map((player, i) => [0, 1].map(side => mode === 'controller' ? down(bindings[i][side], devices) : keys.has(player.keys[side])) as Pair);
  const states: Pair[] = raw.map((pair, i) => pair.map((active, side) => active || pulses[i][side]) as Pair);
  const actions = filter.sample(states, now);
  pulses = emptyPairs();
  let changed = false;
  const cargoPlayers: number[] = [];
  const announcements: string[] = [];
  if (screen === 'practice' && !document.hidden && document.hasFocus()) {
    for (const { pupil, side } of actions) {
      if (pupil >= settings.count) continue;
      flashes[pupil] = `${side ? 'Right' : 'Left'} switch connected.`;
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
      if (answer(session, pupil, side)) { sound(); cargoPlayers.push(pupil); announcements.push(`Player ${pupil + 1}. Cargo ready. Thank you!`); }
      else { flashes[pupil] = 'Let’s count together. You can try again.'; announcements.push(`Player ${pupil + 1}. ${flashes[pupil]}`); }
      changed = true;
    }
  }
  const completed = !!session && !session.finished && ready(session);
  if (transition.sample(now, settings.autoAdvance && completed, screen === 'play' && !paused && !document.hidden, settings.transitionSeconds * 1000)) perform('next');
  if (changed) { render(); if (announcements.length) announce(announcements.join(' ')); cargoPlayers.forEach(animateCargo); }
  requestAnimationFrame(frame);
}
render();
registerOffline((status, update) => {
  offlineStatus = status;
  applyUpdate = update;
  const label = document.getElementById('offline-status');
  if (label) label.textContent = status;
  const updateBar = app.querySelector('.update-bar');
  const showUpdate = Boolean(applyUpdate) && (screen === 'setup' || screen === 'results');
  if (showUpdate && !updateBar) app.insertAdjacentHTML('beforeend', '<div class="update-bar"><button data-action="update">Update game now</button></div>');
  if (!showUpdate) updateBar?.remove();
});
requestAnimationFrame(frame);
