import { gsap } from 'gsap';
import type { Screen } from '../../app/router';
import type { Quality } from '../../settings';
import { mothership } from '../art/mothership';
import { pilot, type PilotMood } from '../art/pilot';
import { skyStars, starBadge } from '../art/stars';
import { idle, isCalm } from '../fx/motion';
import { destroyFx, initFx } from '../fx/pixi';
import { createStage, type Stage } from '../stage';

const moods: PilotMood[] = ['cheer', 'idle', 'think', 'idle'];
// Each pilot starts at its own angle round the mothership (degrees, clockwise from the right); the still scene uses exactly these places.
const START = [200, 340, 20, 160];
const CENTRE = { x: 640, y: 384 }, RADIUS = { x: 440, y: 112 }, PILOT = { w: 200, h: 178 };
const SECONDS = 26;
const place = (degrees: number): { x: number; y: number; depth: number } => {
  const angle = degrees * Math.PI / 180;
  return { x: CENTRE.x + RADIUS.x * Math.cos(angle) - PILOT.w / 2, y: CENTRE.y + RADIUS.y * Math.sin(angle) - PILOT.h / 2, depth: Math.sin(angle) };
};

export function createTitleScreen(options: { quality: Quality; onSetup: () => void }): Screen {
  let stage: Stage | null = null;
  let tweens: gsap.core.Tween[] = [];
  return {
    mount(container) {
      stage = createStage(container);
      stage.element.innerHTML = `<div class="sp-space" aria-hidden="true"><i class="sp-neb sp-neb1"></i><i class="sp-neb sp-neb2"></i><i class="sp-neb sp-neb3"></i>${skyStars(7)}</div>
<main class="sp-title">
<div class="sp-lockup">${starBadge(120)}<div><h1>Number Crew</h1><p class="sp-sub">Star Pilots</p></div></div>
<div class="sp-tship" aria-hidden="true">${mothership(300).replace(/(<text class="sp-core-num"[^>]*>)\d+/, '$1')}</div>
${moods.map((mood, i) => { const at = place(START[i]); return `<div class="sp-tpilot" style="left:${at.x.toFixed(1)}px;top:${at.y.toFixed(1)}px;z-index:${at.depth > 0 ? 3 : 1}"><div class="sp-bob">${pilot(i, mood, PILOT.w)}</div></div>`; }).join('')}
<button class="sp-cta" type="button" aria-describedby="sp-hint">Start</button>
<p class="sp-hint" id="sp-hint">Teacher: press Start to set up the crew</p>
</main>`;
      const button = stage.element.querySelector<HTMLButtonElement>('.sp-cta')!;
      button.addEventListener('click', options.onSetup);
      button.focus({ preventScroll: true });
      const pilots = [...stage.element.querySelectorAll<HTMLElement>('.sp-tpilot')];
      tweens = pilots.flatMap((holder, i) => idle(holder.firstElementChild!, { y: -9, rotation: i % 2 ? 2 : -2, duration: 1.7, delay: i * 0.35 }) ?? []);
      if (!isCalm()) {
        const start = pilots.map((_, i) => place(START[i]));
        const depths = pilots.map(() => 0);
        const turn = { t: 0 };
        tweens.push(gsap.to(turn, {
          t: 1, duration: SECONDS, ease: 'none', repeat: -1,
          onUpdate() {
            pilots.forEach((holder, i) => {
              const now = place(START[i] + turn.t * 360);
              const scale = 0.86 + 0.14 * (now.depth + 1) / 2;
              gsap.set(holder, { x: now.x - start[i].x, y: now.y - start[i].y, scale });
              const depth = now.depth > 0 ? 3 : 1;
              if (depths[i] !== depth) { depths[i] = depth; holder.style.zIndex = String(depth); }
            });
          },
        }));
        tweens.push(gsap.from(stage.element.querySelector('.sp-lockup'), { y: -220, opacity: 0, duration: 1.1, ease: 'bounce.out' }));
        tweens.push(gsap.from(stage.element.querySelector('.sp-tship'), { scale: 0.6, opacity: 0, duration: 0.8, ease: 'back.out(1.8)', delay: 0.3 }));
      }
      void initFx(options.quality);
    },
    unmount() {
      tweens.forEach(tween => tween.kill());
      tweens = [];
      destroyFx();
      stage?.destroy();
      stage = null;
    },
  };
}
