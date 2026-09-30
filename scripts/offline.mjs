import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = (await readdir('dist', { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name !== 'sw.js')
  .map(entry => `${entry.parentPath}/${entry.name}`.replace(/^dist\//, '')).sort();
// The build fails if any file the audio manifest names is missing, so the offline cache can never silently lack a sound.
const manifest = JSON.parse(await readFile('dist/audio/manifest.json', 'utf8'));
const audio = [...Object.values(manifest.music).flatMap(entry => entry.src), ...manifest.sfx.src, ...manifest.voice.src, 'audio/manifest.json'];
const absent = audio.filter(file => !files.includes(file));
if (absent.length) throw new Error(`Audio files missing from dist: ${absent.join(', ')}`);
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(`dist/${file}`));
const version = hash.digest('hex').slice(0, 16);
await writeFile('dist/sw.js', `
const CACHE = 'number-crew-${version}';
const FILES = ${JSON.stringify(files)};
const urls = FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE') self.skipWaiting();
  if (event.data?.type === 'CHECK') event.waitUntil(caches.open(CACHE).then(async cache => {
    const complete = (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage(complete ? 'READY' : 'INCOMPLETE');
  }));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : event.request;
    return await cache.match(key) || fetch(event.request);
  }));
});
`);
console.log(`Precached build ${version}: ${files.length} local assets`);
