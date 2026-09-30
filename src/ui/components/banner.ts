export interface Banner { el: HTMLElement; card: HTMLElement; mount(parent: HTMLElement): void; show(text: string): void; hide(): void }

// Transient celebration card. Purely decorative (aria-hidden): the polite live region and the pills carry the same information.
export function createBanner(): Banner {
  const el = document.createElement('div');
  el.className = 'sp-banner sp-deco';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<p class="sp-banner-card"></p>';
  const card = el.querySelector<HTMLElement>('.sp-banner-card')!;
  return {
    el, card,
    mount(parent) { parent.append(el); },
    show(text) { card.textContent = text; el.hidden = false; },
    hide() { el.hidden = true; },
  };
}
