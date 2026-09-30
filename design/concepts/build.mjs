// Renders each concept board to preview/<name>.html; `node shot.mjs` captures reference PNGs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { previewPage } from './lib.mjs';
mkdirSync('preview', { recursive: true });
for (const key of ['a', 'b', 'c']) {
  const mod = await import(`./${key}.mjs`);
  for (const kind of ['game', 'kit']) writeFileSync(`preview/${key.toUpperCase()}-${kind}.html`, previewPage(mod[kind]()));
}
const boost = await import('./boost.mjs');
for (const kind of ['intro', 'warpLive', 'warpMax', 'fireworksMax', 'bubbleLive']) writeFileSync(`preview/BOOST-${kind}.html`, previewPage(boost[kind]()));
