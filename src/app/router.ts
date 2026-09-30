export interface Screen { mount(container: HTMLElement): void; unmount(): void }
export interface Router<N extends string> {
  register(name: N, screen: Screen): void;
  go(name: N): void;
  current(): N | null;
}

export function createRouter<N extends string>(container: HTMLElement, onChange?: (name: N) => void): Router<N> {
  const screens = new Map<N, Screen>();
  let current: N | null = null;
  return {
    register(name, screen) { screens.set(name, screen); },
    go(name) {
      const next = screens.get(name);
      if (!next) throw new Error(`Unknown screen "${name}"`);
      if (current !== null) screens.get(current)?.unmount();
      container.replaceChildren();
      current = name;
      next.mount(container);
      onChange?.(name);
    },
    current: () => current,
  };
}
