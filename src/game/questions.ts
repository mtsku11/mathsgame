export type Preset = 'count' | 'add5' | 'add10';
export type Side = 0 | 1;
export interface Question {
  kind: 'count' | 'add';
  groups: number[];
  choices: [number, number];
  correct: Side;
  signature: string;
}

export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function question(preset: Preset, random: () => number, previous?: string): Question {
  const max = preset === 'add10' ? 10 : 5;
  const prompts: number[][] = [];
  if (preset === 'count') {
    for (let n = 1; n <= max; n++) prompts.push([n]);
  } else {
    for (let a = 1; a < max; a++) for (let b = 1; a + b <= max; b++) prompts.push([a, b]);
  }
  const eligible = prompts.filter(groups => groups.join('+') !== previous);
  const groups = eligible[Math.floor(random() * eligible.length)];
  const total = groups.reduce((sum, n) => sum + n, 0);
  const distractors = [total - 1, total + 1].filter(n => n >= 1 && n <= max);
  const wrong = distractors[Math.floor(random() * distractors.length)];
  const correct: Side = random() < 0.5 ? 0 : 1;
  return { kind: preset === 'count' ? 'count' : 'add', groups,
    choices: correct === 0 ? [total, wrong] : [wrong, total], correct, signature: groups.join('+') };
}
