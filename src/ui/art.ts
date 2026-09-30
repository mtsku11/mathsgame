export const markers = ['Circle', 'Triangle', 'Square', 'Diamond'];
const markerShapes = ['<circle cx="12" cy="12" r="8"/>', '<path d="M12 3 22 21H2Z"/>', '<rect x="4" y="4" width="16" height="16" rx="2"/>', '<path d="m12 1 11 11-11 11L1 12Z"/>'];
export function marker(index: number): string {
  return `<svg class="marker" viewBox="0 0 24 24" aria-hidden="true">${markerShapes[index]}</svg>`;
}
export function rocket(): string {
  return `<svg class="rocket" viewBox="0 0 220 240" aria-hidden="true"><ellipse cx="110" cy="225" rx="60" ry="8" fill="#102535" opacity=".2"/><path d="M85 151 64 201 99 190M135 151l21 50-35-11" fill="#db794e"/><path d="M97 185q13 45 26 0" fill="#edbb68"/><path d="M110 22C82 54 75 94 81 174q29 20 58 0c6-80-1-120-29-152" fill="#faf5e8" stroke="#203a4c" stroke-width="3"/><path d="M91 51q19-38 38 0Z" fill="#d77f57"/><circle cx="110" cy="102" r="21" fill="#203a4c"/><circle cx="110" cy="102" r="14" fill="#9bd1ce"/><path d="m102 99 8-8" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M84 155h52" stroke="#d77f57" stroke-width="9"/></svg>`;
}
export function planet(index: number, revealed = false): string {
  return `<span class="planet planet-${index} ${revealed ? 'revealed' : ''}" aria-hidden="true"><i></i><b></b><span class="planet-reveal reveal-${index}"></span></span>`;
}
