const f = (n: number): number => +n.toFixed(1);

export function starPath(cx: number, cy: number, outer: number, inner: number, points = 5, rotation = -90): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const angle = (rotation + (i * 180) / points) * Math.PI / 180;
    d += `${i ? 'L' : 'M'}${f(cx + r * Math.cos(angle))} ${f(cy + r * Math.sin(angle))}`;
  }
  return `${d}Z`;
}

export function starBadge(size: number): string {
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2B1E86" stroke="#9D90FF" stroke-width="3"/><path d="${starPath(24, 25.5, 15, 6.5)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

function random(seed: number): () => number {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

export function skyStars(seed: number): string {
  const r = random(seed);
  let s = '';
  for (let i = 0; i < 110; i++) {
    const x = f(r() * 1280), y = f(r() * 720), radius = f(0.6 + r() * 1.8);
    const twinkle = r() < 0.35;
    s += `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff" opacity="${f(0.35 + r() * 0.6)}" ${twinkle ? `class="sp-tw" style="animation-delay:-${f(r() * 3)}s"` : ''}/>`;
  }
  for (let i = 0; i < 7; i++) {
    const x = f(r() * 1280), y = f(r() * 720);
    s += `<path class="sp-tw" style="animation-delay:-${f(r() * 3)}s" d="${starPath(x, y, 7, 2, 4, -90)}" fill="#fff"/>`;
  }
  return `<svg class="sp-sky" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">${s}</svg>`;
}

export function goldStar(): string {
  return `<svg class="sp-star" viewBox="0 0 100 100" aria-hidden="true"><path d="${starPath(50, 54, 44, 19)}" fill="#FFD23F" stroke="#FFD23F" stroke-width="9" stroke-linejoin="round"/><path d="${starPath(50, 54, 26, 11)}" fill="#FFF0A8" opacity=".75"/></svg>`;
}

export const pipSvg = (): string => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${starPath(12, 13, 11, 4.8)}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

export function burstSvg(): string {
  const points = [[0, -1], [.72, -.72], [1, 0], [.72, .72], [0, 1], [-.72, .72], [-1, 0], [-.72, -.72]];
  return `<svg class="sp-burst" viewBox="-100 -100 200 200" aria-hidden="true">${points.map(([x, y], i) => `<path d="${starPath(x * 84, y * 84, 9, 3.6)}" fill="${i % 2 ? '#fff' : '#FFD23F'}"/>`).join('')}</svg>`;
}

// Small star cluster for picture answers: rows of at most five, each row centred.
export function starCluster(count: number): string {
  const cell = 26, columns = Math.min(count, 5), rows = Math.ceil(count / 5);
  let paths = '';
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 5), inRow = Math.min(5, count - row * 5);
    const x = (columns - inRow) * cell / 2 + (i % 5) * cell + cell / 2;
    paths += `<path d="${starPath(x, row * cell + cell / 2 + 1, 12, 5.2)}"/>`;
  }
  return `<svg class="sp-pic" viewBox="0 0 ${columns * cell} ${rows * cell + 2}" aria-hidden="true">${paths}</svg>`;
}
