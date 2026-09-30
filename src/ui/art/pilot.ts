export type PilotMood = 'idle' | 'cheer' | 'think';
export const pilotColors = [
  { color: '#FF5DA2', light: '#FFB3D4', name: 'Pink pilot' },
  { color: '#36D6FF', light: '#AEEFFF', name: 'Blue pilot' },
  { color: '#FF9F43', light: '#FFD3A6', name: 'Orange pilot' },
  { color: '#9DF26B', light: '#D6FBC0', name: 'Green pilot' },
] as const;

const ink = '#1A1446';
const stroke = (d: string, color: string, width: number): string => `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;

export function pilot(player: number, mood: PilotMood = 'idle', width = 132): string {
  const { color: c, light: l } = pilotColors[player];
  let eyes: string, mouth: string, arms = '';
  if (mood === 'cheer') {
    eyes = `${stroke('M49 58 Q57 47 65 58', ink, 5)}${stroke('M75 58 Q83 47 91 58', ink, 5)}`;
    mouth = `<path d="M57 67 Q70 90 83 67 Z" fill="${ink}"/><path d="M62 76 Q70 84 78 76 Q70 72 62 76Z" fill="#FF7FA8"/>`;
    arms = `${stroke('M44 70 Q36 60 40 46', c, 8)}${stroke('M96 70 Q104 60 100 46', c, 8)}<circle cx="40" cy="44" r="7" fill="${l}"/><circle cx="100" cy="44" r="7" fill="${l}"/>`;
  } else if (mood === 'think') {
    eyes = `<circle cx="58" cy="58" r="10" fill="#fff"/><circle cx="82" cy="58" r="10" fill="#fff"/><circle cx="61" cy="53" r="5" fill="${ink}"/><circle cx="85" cy="53" r="5" fill="${ink}"/>${stroke('M76 42 Q84 38 92 43', ink, 3.5)}`;
    mouth = `<ellipse cx="73" cy="75" rx="4" ry="5" fill="${ink}"/>`;
  } else {
    eyes = `<circle cx="58" cy="58" r="10" fill="#fff"/><circle cx="82" cy="58" r="10" fill="#fff"/><circle cx="59" cy="60" r="5.5" fill="${ink}"/><circle cx="83" cy="60" r="5.5" fill="${ink}"/><circle cx="61" cy="57" r="2" fill="#fff"/><circle cx="85" cy="57" r="2" fill="#fff"/>`;
    mouth = stroke('M62 71 Q70 79 78 71', ink, 4);
  }
  return `<svg class="pilot" viewBox="0 0 140 124" width="${width}" height="${+(width * 124 / 140).toFixed(1)}" aria-hidden="true">
<ellipse cx="70" cy="116" rx="44" ry="6" fill="${c}" opacity=".35"/>
<ellipse cx="70" cy="90" rx="62" ry="17" fill="#3F32A8"/>
${stroke('M70 32 Q64 18 56 14', c, 4)}<circle cx="55" cy="13" r="6" fill="${l}"/>
${stroke('M84 34 Q92 22 100 20', c, 4)}<circle cx="101" cy="19" r="5" fill="${l}"/>
${arms}
<circle cx="70" cy="64" r="31" fill="${c}"/>
<ellipse cx="62" cy="48" rx="12" ry="7" fill="#fff" opacity=".28"/>
<ellipse cx="50" cy="70" rx="6" ry="4" fill="#fff" opacity=".35"/><ellipse cx="90" cy="70" rx="6" ry="4" fill="#fff" opacity=".35"/>
${eyes}${mouth}
<path d="M23 90 A47 47 0 0 1 117 90 Z" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
<path d="M36 72 A36 36 0 0 1 56 50" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round" fill="none"/>
<ellipse cx="70" cy="95" rx="65" ry="16" fill="#CFC8FF"/>
<ellipse cx="70" cy="90" rx="58" ry="9" fill="#EFEBFF"/>
<circle cx="24" cy="99" r="4" fill="${c}"/><circle cx="46" cy="104" r="4" fill="${c}"/><circle cx="70" cy="106" r="4" fill="${c}"/><circle cx="94" cy="104" r="4" fill="${c}"/><circle cx="116" cy="99" r="4" fill="${c}"/>
</svg>`;
}
