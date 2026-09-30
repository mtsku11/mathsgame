export interface PauseState { paused: boolean; reason: string; recovering: boolean; quiet: boolean; volume: number; boost: boolean }
export interface PauseOverlay { mount(parent: HTMLElement): void; update(state: PauseState): void }

export function createPauseOverlay(): PauseOverlay {
  const el = document.createElement('div');
  el.className = 'sp-pause-backdrop';
  el.hidden = true;
  el.innerHTML = `<section class="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabindex="-1"><p class="sp-eyebrow">TAKE A BREATHER</p><h1 id="pause-title">Journey paused</h1><p class="sp-reason"></p><p class="sp-muted">Release all switches before continuing.</p>
<div class="sp-stack"><button type="button" class="sp-primary" data-action="resume">Resume journey</button><button type="button" class="sp-secondary" data-action="sound"></button>
<label class="sp-volume">Effects volume<select id="effects-volume" aria-describedby="volume-note">${[0, 25, 50, 75, 100].map(value => `<option value="${value}">${value === 0 ? 'Off' : `${value}%`}</option>`).join('')}</select></label><p id="volume-note" class="sp-muted">Quiet mode mutes effects at every volume.</p>
<button type="button" class="sp-secondary" data-action="skip-boost" hidden>Skip boost round</button><button type="button" class="sp-secondary" data-action="finish">End journey &amp; return to setup</button></div></section>`;
  const reason = el.querySelector<HTMLElement>('.sp-reason')!;
  const primary = el.querySelector<HTMLButtonElement>('.sp-primary')!;
  const sound = el.querySelector<HTMLButtonElement>('[data-action="sound"]')!;
  const volume = el.querySelector<HTMLSelectElement>('#effects-volume')!;
  const skip = el.querySelector<HTMLButtonElement>('[data-action="skip-boost"]')!;
  return {
    mount(parent) { parent.append(el); },
    update(state) {
      const text = state.reason || 'Your crew’s progress is safe. Take all the time you need.';
      if (reason.textContent !== text) reason.textContent = text;
      const action = state.recovering ? 'reconnect' : 'resume';
      if (primary.dataset.action !== action) { primary.dataset.action = action; primary.textContent = state.recovering ? 'Reconnect & check switches' : 'Resume journey'; }
      const label = state.quiet ? 'Enable gentle sound' : 'Turn sound off';
      if (sound.textContent !== label) sound.textContent = label;
      if (volume.value !== String(state.volume)) volume.value = String(state.volume);
      if (skip.hidden === state.boost) skip.hidden = !state.boost;
      if (el.hidden === state.paused) {
        el.hidden = !state.paused;
        if (state.paused) el.querySelector<HTMLElement>('button, select')?.focus();
      }
    },
  };
}
