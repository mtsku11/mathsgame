import '../pages.css';
import type { Screen } from '../../app/router';
import type { Preset, Side } from '../../game/questions';
import type { BoostPower, BoostSettings, Settings } from '../../settings';
import { icons, shapeMarker } from '../art/icons';
import { pilot, pilotColors } from '../art/pilot';
import { caps, type CapColour } from '../art/caps';
import { skyStars, starBadge } from '../art/stars';
import { setLowStim, setReducedMotion } from '../fx/motion';

export type InputMode = 'controller' | 'keyboard';
export interface SetupState { offline: string; canUpdate: boolean; notice: string }
export interface SetupScreen extends Screen { update(state: SetupState): void }
export interface SetupHooks {
  settings: Settings;
  mode(): InputMode;
  setMode(mode: InputMode): void;
  refreshAudio(): void;
}

const plural = (count: number): string => `${count} player${count === 1 ? '' : 's'}`;
const checked = (value: boolean): string => value ? 'checked' : '';
const selected = (value: boolean): string => value ? 'selected' : '';
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function createSetupScreen(source: () => SetupState, hooks: SetupHooks): SetupScreen {
  const { settings } = hooks;
  let root: HTMLElement | null = null;
  const find = <T extends HTMLElement>(selector: string): T => root!.querySelector<T>(selector)!;

  const pupilRows = (): string => settings.players.slice(0, settings.count).map((player, i) => `<div class="tp-pupil tp-p${i}"><div class="tp-pupil-head">${pilot(i, 'idle', 78)}<div><strong>Player ${i + 1}</strong><span><i class="tp-shape">${shapeMarker(i, 18)}</i>${pilotColors[i].name}</span></div></div>
<label class="tp-field"><span>Maths</span><select id="preset-${i}" data-preset="${i}" aria-label="Player ${i + 1} maths"><option value="count" ${selected(player.preset === 'count')}>Count 1–5</option><option value="add5" ${selected(player.preset === 'add5')}>Add within 5</option><option value="add10" ${selected(player.preset === 'add10')}>Add within 10</option></select></label>
<label class="tp-field"><span>Boost power</span><select id="power-${i}" data-boost-power="${i}" aria-label="Player ${i + 1} boost power">${([1, 2, 3] as const).map(n => `<option value="${n}" ${selected(player.boostPower === n)}>×${n} ${n === 1 ? '(normal)' : n === 2 ? '(double)' : '(triple)'}</option>`).join('')}</select></label></div>`).join('');

  const accessRows = (): string => settings.players.slice(0, settings.count).map((player, i) => `<fieldset class="tp-sub"><legend class="sr-only">Player ${i + 1} access</legend><h3>Player ${i + 1} · ${pilotColors[i].name}</h3>
<label class="tp-check"><input type="checkbox" data-quantity="${i}" ${checked(player.quantities)}> Picture answers for addition</label>
<div class="tp-row"><label class="tp-field"><span>Input cooldown</span><select data-cooldown="${i}">${[0, 250, 500, 750, 1000, 1500].map(n => `<option value="${n}" ${selected(player.cooldown === n)}>${n} ms</option>`).join('')}</select></label>
${player.caps.map((cap, side) => `<label class="tp-field"><span>${side ? 'Right' : 'Left'} switch colour</span><select aria-label="Player ${i + 1} ${side ? 'right' : 'left'} switch colour" data-cap-player="${i}" data-cap-side="${side}"><option value="pilot" ${selected(cap === 'pilot')}>Pilot colour</option>${caps.map(spec => `<option value="${spec.id}" ${selected(cap === spec.id)}>${spec.name}</option>`).join('')}</select></label>`).join('')}
${player.keys.map((key, side) => `<label class="tp-field"><span>${side ? 'Right' : 'Left'} keyboard key</span><select aria-label="Player ${i + 1} ${side ? 'right' : 'left'} key" data-key-player="${i}" data-key-side="${side}">${letters.map(letter => `<option value="Key${letter}" ${selected(key === `Key${letter}`)}>${letter}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`).join('');

  const volume = (id: string, label: string, value: number, describe = ''): string =>
    `<label class="tp-field"><span>${label} volume</span><select id="${id}-volume"${describe}>${[0, 25, 50, 75, 100].map(level => `<option value="${level}" ${selected(value === level)}>${level === 0 ? 'Off' : `${level}%`}</option>`).join('')}</select></label>`;

  function markup(): string {
    const { boost } = settings;
    const mode = hooks.mode();
    return `<div class="tp" data-page="setup"><div class="tp-deco" aria-hidden="true">${skyStars(3).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ')}</div>
<header class="tp-bar"><div class="tp-brand">${starBadge(52)}<div><span class="tp-name">Number Crew</span><span class="tp-tag">Star Pilots · Teacher setup</span></div></div>
<div class="tp-status"><span class="tp-dot" aria-hidden="true"></span><span id="offline-status"></span><button type="button" class="tp-btn" data-action="update" hidden>Update game now</button></div></header>
<main class="tp-main"><div class="tp-intro"><h1>Get the crew ready</h1><p>Choose what works for your classroom. Maths is never timed, and no names or accounts are needed. Everything here stays on this computer.</p></div>
<div class="tp-grid">
<section class="tp-card wide" aria-labelledby="tp-crew-title"><h2 id="tp-crew-title">The crew</h2><p class="tp-hint">Pick how many pilots play, and the maths each one gets.</p>
<div class="tp-row"><label class="tp-field"><span>Crew size</span><select id="crew-count">${[1, 2, 3, 4].map(n => `<option value="${n}" ${selected(settings.count === n)}>${plural(n)}</option>`).join('')}</select></label>
<label class="tp-field"><span>Screen layout</span><select id="layout"><option value="together" ${selected(!settings.enlarged)}>Play together</option><option value="enlarged" ${selected(settings.enlarged)}>Spotlight turns</option></select></label></div>
<div class="tp-crew" id="tp-crew">${pupilRows()}</div></section>
<section class="tp-card" aria-labelledby="tp-input-title"><fieldset class="tp-choices"><legend id="tp-input-title">How will the crew answer?</legend>
<label class="tp-choice"><input type="radio" name="input-mode" value="controller" ${checked(mode === 'controller')}><span>Xbox Adaptive Controller<small>One shared controller · 2 switches per player</small></span></label>
<label class="tp-choice"><input type="radio" name="input-mode" value="keyboard" ${checked(mode === 'keyboard')}><span>Keyboard &amp; on-screen buttons<small>Try the game without a controller</small></span></label></fieldset></section>
<section class="tp-card" aria-labelledby="tp-flow-title"><h2 id="tp-flow-title">Between rounds</h2><p class="tp-hint">Choose whether you or the game moves the crew on.</p>
<label class="tp-check"><input id="auto-advance" type="checkbox" ${checked(settings.autoAdvance)}> Advance completed rounds automatically</label>
<div class="tp-row"><label class="tp-field"><span>Celebration delay</span><select id="transition-seconds">${Array.from({ length: 9 }, (_, i) => i + 2).map(n => `<option value="${n}" ${selected(settings.transitionSeconds === n)}>${n} seconds</option>`).join('')}</select></label></div></section>
<section class="tp-card wide" aria-labelledby="tp-boost-title"><fieldset><legend id="tp-boost-title">Boost rounds</legend><p class="tp-hint">After each maths round the crew presses their switches as fast as they can to power something amazing. It cannot be failed, and the maths itself stays untimed. Set each pilot’s boost power above.</p>
<div class="tp-checks"><label class="tp-check"><input id="boost-enabled" type="checkbox" ${checked(boost.enabled)}> Boost round after every maths round</label><label class="tp-check"><input id="boost-auto" type="checkbox" ${checked(boost.autoStart)}> Start each boost round automatically</label></div>
<div class="tp-row"><label class="tp-field"><span>Boost length</span><select id="boost-seconds">${[8, 12, 16, 20].map(n => `<option value="${n}" ${selected(boost.seconds === n)}>${n} seconds</option>`).join('')}</select></label>
<label class="tp-field"><span>Boost difficulty</span><select id="boost-difficulty">${(['easy', 'normal', 'hard'] as const).map(level => `<option value="${level}" ${selected(boost.difficulty === level)}>${level[0].toUpperCase()}${level.slice(1)}</option>`).join('')}</select></label></div></fieldset></section>
<details class="tp-card wide tp-details"><summary>Comfort &amp; access settings</summary>
<div class="tp-checks"><label class="tp-check"><input id="quiet" type="checkbox" ${checked(settings.quiet)}> Quiet mode</label><label class="tp-check"><input id="reduced" type="checkbox" ${checked(settings.reduced)}> Reduce motion</label><label class="tp-check"><input id="low-stim" type="checkbox" ${checked(settings.lowStim)}> Low stimulation</label><label class="tp-check"><input id="simple" type="checkbox" ${checked(settings.simple)}> Less decoration</label></div>
<p class="tp-hint">Low stimulation turns the music off, softens effects and keeps only the sounds that answer a press.</p>
<div class="tp-row">${volume('effects', 'Effects', settings.effectsVolume, ' aria-describedby="volume-note"')}${volume('music', 'Music', settings.musicVolume)}${volume('voice', 'Voice', settings.voiceVolume)}</div>
<div class="tp-checks"><label class="tp-check"><input id="narration" type="checkbox" ${checked(settings.narration)}> Voice narration</label></div><p id="volume-note" class="tp-hint">Quiet mode mutes all sound at every volume.</p>
<div id="tp-access">${accessRows()}</div></details>
</div>
<p class="tp-notice" role="status"></p>
<div class="tp-actions"><button type="button" class="tp-go" data-action="prepare"></button><p class="tp-foot">Teacher-led · 6 rounds · No names or accounts</p></div></main></div>`;
  }

  const primaryLabel = (): string => `${hooks.mode() === 'controller' ? 'Set up the switches' : 'Start crew check-in'} <span aria-hidden="true">${icons.arrow(24)}</span>`;
  function syncPrimary(): void { find('[data-action="prepare"]').innerHTML = primaryLabel(); }
  function syncPlayers(): void { find('#tp-crew').innerHTML = pupilRows(); find('#tp-access').innerHTML = accessRows(); }

  function onChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const notice = find('.tp-notice');
    if (target.id === 'crew-count') { settings.count = Number(target.value); syncPlayers(); }
    else if (target.id === 'auto-advance') settings.autoAdvance = target.checked;
    else if (target.id === 'transition-seconds') settings.transitionSeconds = Number(target.value);
    else if (target.id === 'layout') settings.enlarged = target.value === 'enlarged';
    else if (target.id === 'boost-enabled') settings.boost.enabled = target.checked;
    else if (target.id === 'boost-auto') settings.boost.autoStart = target.checked;
    else if (target.id === 'boost-seconds') settings.boost.seconds = Number(target.value) as BoostSettings['seconds'];
    else if (target.id === 'boost-difficulty') settings.boost.difficulty = target.value as BoostSettings['difficulty'];
    else if (target.dataset.boostPower !== undefined) settings.players[Number(target.dataset.boostPower)].boostPower = Number(target.value) as BoostPower;
    else if (target.name === 'input-mode') { hooks.setMode(target.value as InputMode); syncPrimary(); }
    else if (target.dataset.preset !== undefined) settings.players[Number(target.dataset.preset)].preset = target.value as Preset;
    else if (target.dataset.quantity !== undefined) settings.players[Number(target.dataset.quantity)].quantities = target.checked;
    else if (target.dataset.cooldown !== undefined) settings.players[Number(target.dataset.cooldown)].cooldown = Number(target.value);
    else if (target.dataset.capPlayer !== undefined) settings.players[Number(target.dataset.capPlayer)].caps[Number(target.dataset.capSide)] = target.value as CapColour;
    else if (target.dataset.keyPlayer !== undefined) {
      const player = Number(target.dataset.keyPlayer), side = Number(target.dataset.keySide) as Side;
      if (settings.players.some((p, i) => p.keys.some((key, s) => key === target.value && (i !== player || s !== side)))) {
        notice.textContent = 'That key is already assigned. Choose a different letter.';
        target.value = settings.players[player].keys[side];
      } else { settings.players[player].keys[side] = target.value; notice.textContent = ''; }
    }
    else if (target.id === 'quiet') { settings.quiet = target.checked; hooks.refreshAudio(); }
    else if (target.id === 'reduced') { settings.reduced = target.checked; setReducedMotion(target.checked); }
    else if (target.id === 'low-stim') { settings.lowStim = target.checked; setLowStim(target.checked); hooks.refreshAudio(); }
    else if (target.id === 'simple') { settings.simple = target.checked; document.body.classList.toggle('simple', target.checked); }
  }

  return {
    mount(container) {
      container.insertAdjacentHTML('beforeend', markup());
      root = container.querySelector<HTMLElement>('.tp[data-page="setup"]')!;
      find('.tp-notice').textContent = source().notice;
      syncPrimary();
      root.addEventListener('change', onChange);
      this.update(source());
      find<HTMLSelectElement>('#crew-count').focus({ preventScroll: true });
    },
    update(state) {
      if (!root) return;
      find('#offline-status').textContent = state.offline;
      find('[data-action="update"]').hidden = !state.canUpdate;
    },
    unmount() { root?.removeEventListener('change', onChange); root = null; },
  };
}
