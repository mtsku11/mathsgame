import type { Screen } from '../../app/router';
import type { Quality } from '../../settings';
import { pilot, type PilotMood } from '../art/pilot';
import { skyStars, starBadge } from '../art/stars';
import { idle } from '../fx/motion';
import { destroyFx, initFx } from '../fx/pixi';
import { createStage, type Stage } from '../stage';

const moods: PilotMood[] = ['cheer', 'idle', 'think', 'idle'];

export function createTitleScreen(options: { quality: Quality; onSetup: () => void }): Screen {
  let stage: Stage | null = null;
  let bobs: gsap.core.Tween[] = [];
  return {
    mount(container) {
      stage = createStage(container);
      stage.element.innerHTML = `<div class="sp-space" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(7)}</div>
<main class="sp-title">
<div class="sp-lockup">${starBadge(120)}<div><h1>Number Crew</h1><p class="sp-sub">Star Pilots</p></div></div>
<div class="sp-crew">${moods.map((mood, i) => `<div class="sp-pilot">${pilot(i, mood, 220)}</div>`).join('')}</div>
<button class="sp-cta" type="button">Teacher setup</button>
</main>`;
      const button = stage.element.querySelector<HTMLButtonElement>('.sp-cta')!;
      button.addEventListener('click', options.onSetup);
      button.focus({ preventScroll: true });
      bobs = [...stage.element.querySelectorAll('.sp-pilot')].flatMap((pilotElement, i) =>
        idle(pilotElement, { y: -9, rotation: i % 2 ? 2 : -2, duration: 1.7, delay: i * 0.35 }) ?? []);
      void initFx(options.quality);
    },
    unmount() {
      bobs.forEach(bob => bob.kill());
      bobs = [];
      destroyFx();
      stage?.destroy();
      stage = null;
    },
  };
}
