const svg = (size: number, body: string, extra = ''): string => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${extra}>${body}</svg>`;
const line = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

export const icons = {
  pause: (size = 22): string => svg(size, '<rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor"/>'),
  help: (size = 20): string => svg(size, '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>', `${line} stroke-width="2.4"`),
  pass: (size = 20): string => svg(size, '<path d="m5 6 6 6-6 6M13 6l6 6-6 6"/>', `${line} stroke-width="2.4"`),
  chevL: (size = 18): string => svg(size, '<path d="m15 5-7 7 7 7"/>', `${line} stroke-width="3.2"`),
  chevR: (size = 18): string => svg(size, '<path d="m9 5 7 7-7 7"/>', `${line} stroke-width="3.2"`),
  arrow: (size = 20): string => svg(size, '<path d="M5 12h13M13 6l6 6-6 6"/>', `${line} stroke-width="3"`),
  tick: (size = 24): string => svg(size, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', `${line} stroke-width="4"`),
};

const shapes = [
  '<circle cx="12" cy="12" r="9"/>',
  '<path d="M12 2.5 22 20.5H2Z" stroke-linejoin="round"/>',
  '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  '<path d="m12 1.5 10.5 10.5L12 22.5 1.5 12Z" stroke-linejoin="round"/>',
];
export const shapeNames = ['Circle', 'Triangle', 'Square', 'Diamond'] as const;
export const shapeMarker = (player: number, size = 26): string => svg(size, `<g fill="currentColor">${shapes[player]}</g>`);
