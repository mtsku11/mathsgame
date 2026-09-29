import { defineConfig } from '@playwright/test';

const hostedURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: hostedURL ? `${hostedURL.replace(/\/$/, '')}/` : 'http://127.0.0.1:4173/', viewport: { width: 1280, height: 800 } },
  webServer: hostedURL ? undefined : { command: 'npm run dev -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
