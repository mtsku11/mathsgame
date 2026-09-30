import { defineConfig } from '@playwright/test';

const hostedURL = process.env.PLAYWRIGHT_BASE_URL;
if (!hostedURL) throw new Error('Set PLAYWRIGHT_BASE_URL to the published game URL.');

export default defineConfig({
  testDir: './tests',
  // Only specs that need no dev-server module hooks (window.__nc); the rest run against the dev server in `npm run test:e2e`.
  testMatch: ['browser/{access,controller,game,title}.spec.ts', 'hosted/*.spec.ts'],
  outputDir: './test-results/hosted',
  use: { baseURL: `${hostedURL.replace(/\/$/, '')}/`, viewport: { width: 1280, height: 720 } },
});
