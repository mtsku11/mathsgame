import { defineConfig } from 'vite';

// Two pages: the game, and pad.html, the page a pupil's tablet opens to become that pupil's two switches.
export default defineConfig({ base: './', build: { rollupOptions: { input: { main: 'index.html', pad: 'pad.html' } } } });
