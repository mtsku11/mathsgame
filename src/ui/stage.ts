export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export interface Stage { viewport: HTMLElement; element: HTMLElement; destroy(): void }

export const fitScale = (width: number, height: number): number => Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);

let active: Stage | null = null;
let scale = 1;
export const stageScale = (): number => scale;
export const stageElement = (): HTMLElement | null => active?.element ?? null;

// Centre of an element in logical stage coordinates (1280x720), whatever the current window scale.
export function stagePoint(target: Element, ax = 0.5, ay = 0.5): { x: number; y: number } {
  const stage = active?.element.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  if (!stage) return { x: box.left + box.width * ax, y: box.top + box.height * ay };
  return { x: (box.left + box.width * ax - stage.left) / scale, y: (box.top + box.height * ay - stage.top) / scale };
}

export function createStage(parent: HTMLElement): Stage {
  active?.destroy();
  const viewport = document.createElement('div');
  viewport.className = 'stage-viewport';
  const element = document.createElement('div');
  element.className = 'stage';
  viewport.append(element);
  parent.append(viewport);
  const layout = (): void => {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    scale = fitScale(width, height);
    element.style.transform = `translate(${Math.floor((width - STAGE_WIDTH * scale) / 2)}px, ${Math.floor((height - STAGE_HEIGHT * scale) / 2)}px) scale(${scale})`;
  };
  const observer = new ResizeObserver(layout);
  observer.observe(viewport);
  layout();
  const stage: Stage = {
    viewport, element,
    destroy() { observer.disconnect(); viewport.remove(); if (active === stage) active = null; },
  };
  active = stage;
  return stage;
}
